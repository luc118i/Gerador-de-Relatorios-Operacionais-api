import {
  getTypeIdByCode,
  insertOccurrence,
  insertDrivers,
  insertPoints,
  listOccurrencesByDay,
  getBaseCodeFromOccurrenceDriver,
  updateOccurrenceBaseCode,
  getDriverBaseById,
  updateOccurrenceData,
  getDriverSnapshotByOccurrence,
  getLocalIdByNome,
} from "./occurrences.repo.js";

import { fetchTripById } from "../trips/trips.repo.js";

import { notifyAppsScript, notifyAppsScriptExcesso } from "../../core/infra/appsScript.service.js";

/** Monta o array de pontos de uma ocorrência EXCESSO_PERMANENCIA: usa
 * payload.points se vier (grupo — motorista excedeu em N pontos na mesma
 * viagem), senão cai pro ponto único dos campos de topo (fluxo individual,
 * comportamento de sempre). */
function resolvePoints(payload: any) {
  if (Array.isArray(payload.points) && payload.points.length > 0) {
    return payload.points as Array<{
      place: string; startTime: string; endTime: string;
      cidade?: string; uf?: string; regiao?: string;
      permanenciaMin?: number; permitidoMin?: number; excedenteMin?: number;
      lat?: number | null; lng?: number | null;
    }>;
  }
  return [{
    place: payload.place || "",
    startTime: payload.startTime,
    endTime: payload.endTime,
    cidade: payload.cidade,
    uf: payload.uf,
    regiao: payload.regiao,
    permanenciaMin: payload.permanenciaMin,
    permitidoMin: payload.permitidoMin,
    excedenteMin: payload.excedenteMin,
    lat: payload.lat ?? null,
    lng: payload.lng ?? null,
  }];
}

/** Resume N pontos em start_time/end_time/place pra exibição em listagem:
 * menor entrada, maior saída, "N paradas" quando há mais de 1 ponto. */
function summarizePoints(points: Array<{ place: string; startTime: string; endTime: string }>) {
  if (points.length === 1) {
    return { startTime: points[0]!.startTime, endTime: points[0]!.endTime, place: points[0]!.place };
  }
  const starts = points.map((p) => p.startTime).sort();
  const ends = points.map((p) => p.endTime).sort();
  return {
    startTime: starts[0]!,
    endTime: ends[ends.length - 1]!,
    place: `${points.length} paradas`,
  };
}

export async function createOccurrence(payload: any) {
  const typeId = await getTypeIdByCode(payload.typeCode);
  const tripulacaoAtiva = payload.showSectionTripulacao !== false;
  const drivers = tripulacaoAtiva ? validateDrivers(payload.drivers) : [];

  const driver1 = drivers.find((d) => d.position === 1);

  // EXCESSO_PERMANENCIA: pode vir com N pontos (payload.points) — os campos
  // start_time/end_time/place gravados na ocorrência viram um resumo.
  const isExcessoPermanencia = payload.typeCode === "EXCESSO_PERMANENCIA";
  const points = isExcessoPermanencia ? resolvePoints(payload) : null;
  const summary = points ? summarizePoints(points) : null;

  // baseCode vem do payload OU do driver.base OU "GENERICO" quando sem tripulação
  let baseCode = payload.baseCode?.trim() ?? "";
  if (!baseCode && driver1?.driverId) {
    baseCode = (await getDriverBaseById(driver1.driverId)) ?? "";
  }
  if (!baseCode && driver1?.baseCode) {
    baseCode = driver1.baseCode.trim();
  }
  if (!baseCode && tripulacaoAtiva && !driver1?.driverId) {
    baseCode = "GENERICO";
  }
  if (!baseCode && tripulacaoAtiva) {
    throw new Error("Não foi possível derivar baseCode do Motorista 01.");
  }
  if (!baseCode) baseCode = "GENERICO";

  // 1) cria ocorrência já com base_code válido (não quebra NOT NULL)
  const id = await insertOccurrence({
    type_id: typeId,
    event_date: payload.eventDate,
    trip_date: payload.tripDate,
    trip_id: payload.tripId ?? null,
    start_time: summary?.startTime ?? payload.startTime,
    end_time: summary?.endTime ?? payload.endTime,
    vehicle_number: payload.vehicleNumber,
    base_code: baseCode,
    line_label: payload.lineLabel ?? null,
    place: summary?.place ?? payload.place ?? "",
    speed_kmh: payload.speedKmh ?? null,
    trip_time: payload.tripTime || null,
    session_time: payload.sessionTime || null,
    occurrence_name: payload.occurrenceName ?? null,
    report_title: payload.reportTitle ?? null,
    cco_operator: payload.ccoOperator ?? null,
    vehicle_km: payload.vehicleKm ?? null,
    passenger_count: payload.passengerCount ?? null,
    passenger_connection: payload.passengerConnection ?? null,
    relato_html: payload.relatoHtml ?? null,
    devolutiva_html: payload.devolutivaHtml ?? null,
    devolutiva_status: payload.devolutivaStatus ?? null,
    show_section_viagem: payload.showSectionViagem ?? true,
    show_section_identificacao: payload.showSectionIdentificacao ?? true,
    show_section_dados: payload.showSectionDados ?? true,
    show_section_tripulacao: payload.showSectionTripulacao ?? true,
    show_section_passageiros: payload.showSectionPassageiros ?? true,
    devolutiva_before_evidences: payload.devolutivaBeforeEvidences ?? false,
    tratativa: payload.tratativa ?? null,
    analisado_por: payload.analisadoPor ?? null,
  });

  // 2) cria vínculos (trigger preenche snapshot)
  await insertDrivers(id, drivers);

  // 3) opcional: se quiser “garantir” que bate com o snapshot do motorista 01
  const snapshotBase = await getBaseCodeFromOccurrenceDriver(id);
  if (snapshotBase && snapshotBase !== baseCode) {
    await updateOccurrenceBaseCode(id, snapshotBase);
  }

  // 4) grava os pontos de parada (1 ou N) da ocorrência EXCESSO_PERMANENCIA
  if (points) {
    await insertPoints(id, points);
  }

  // Cria ocorrências PARADA_FORA para cada parada proibida detectada na análise operacional
  const paradaForaIds: string[] = [];
  if (
    payload.typeCode === "ANALISE_OP" &&
    driver1 &&
    Array.isArray(payload.paradasProibidas) &&
    payload.paradasProibidas.length > 0
  ) {
    for (const parada of payload.paradasProibidas as Array<{ localNome: string; localCodigo: string | null }>) {
      try {
        const paradaId = await createOccurrence({
          typeCode: "DESCUMP_OP_PARADA_FORA",
          eventDate: payload.eventDate,
          tripDate: payload.tripDate,
          startTime: payload.startTime,
          endTime: payload.endTime,
          vehicleNumber: payload.vehicleNumber,
          lineLabel: payload.lineLabel ?? null,
          tripId: payload.tripId ?? null,
          tripTime: payload.tripTime ?? null,
          place: parada.localNome,
          relatoHtml: payload.paradaForaRelatoHtml ?? "",
          showSectionTripulacao: true,
          showSectionViagem: true,
          showSectionIdentificacao: true,
          showSectionDados: true,
          showSectionPassageiros: false,
          devolutivaBeforeEvidences: false,
          drivers: [{ position: 1 as const, driverId: driver1.driverId, name: driver1.name, registry: driver1.registry, baseCode: driver1.baseCode }],
        });
        if (typeof paradaId === "string") paradaForaIds.push(paradaId);
      } catch (err) {
        console.error("[createOccurrence] Falha ao criar PARADA_FORA para", parada.localNome, err);
      }
    }
  }

  // Notifica planilha apenas para ocorrências de Parada Fora do Programado
  if (payload.typeCode === "DESCUMP_OP_PARADA_FORA" && driver1) {
    const driver1Snapshot = await getDriverSnapshotByOccurrence(id, 1);
    const driver2 = drivers.find((d) => d.position === 2);
    const localIdNum = payload.placeCode
      ? null
      : await getLocalIdByNome(payload.place);
    const localIdStr = payload.placeCode
      ? String(payload.placeCode)
      : localIdNum
        ? String(localIdNum)
        : "0"; // fallback: Apps Script valida campo não-vazio; 0 sinaliza "local não mapeado"
    const driverBase = driver1.driverId ? await getDriverBaseById(driver1.driverId) : undefined;
    const tripData = (!payload.lineLabel && payload.tripId)
      ? await fetchTripById(payload.tripId)
      : null;
    const linhaStr = (() => {
      const label = payload.lineLabel ?? "";
      let code: string, route: string;
      if (label) {
        const dashIdx = label.indexOf(" - ");
        code  = dashIdx >= 0 ? label.slice(0, dashIdx) : label;
        route = dashIdx >= 0 ? label.slice(dashIdx + 3) : "";
      } else if (tripData) {
        code  = tripData.line_code;
        route = tripData.line_name;
      } else {
        return "";
      }
      const time    = payload.tripTime    ?? tripData?.departure_time ?? "";
      const sentido = payload.tripSentido ?? tripData?.direction      ?? "";
      return [code, route, time, sentido].join("|");
    })();

    // motorista 1
    await notifyAppsScript({
      localId: localIdStr,
      localNome: payload.place || "—",
      carro: payload.vehicleNumber,
      motoristaId: driver1Snapshot?.registry ?? driver1.driverId,
      motoristaNome: driver1Snapshot?.name ?? "",
      base: driver1Snapshot?.base_code || driverBase || baseCode,
      dataRelatorio: payload.eventDate,
      linha: linhaStr,
    });

    // motorista 2 (se existir)
    if (driver2) {
      const driver2Snapshot = await getDriverSnapshotByOccurrence(id, 2);
      const driver2Base = driver2.driverId ? await getDriverBaseById(driver2.driverId) : undefined;

      await notifyAppsScript({
        localId: localIdStr,
        localNome: payload.place || "—",
        carro: payload.vehicleNumber,
        motoristaId: driver2Snapshot?.registry ?? driver2.driverId,
        motoristaNome: driver2Snapshot?.name ?? "",
        base: driver2Snapshot?.base_code || driver2Base || baseCode,
        dataRelatorio: payload.eventDate,
        linha: linhaStr,
      });
    }
  }

  // Notifica planilha (aba HISTORICO_EXCESSO) para excedências de tempo de permanência
  // — 1 chamada por ponto, preservando o histórico granular por parada mesmo
  // quando N pontos foram agrupados em 1 única ocorrência.
  if (isExcessoPermanencia && driver1 && points) {
    const driver1Snapshot = await getDriverSnapshotByOccurrence(id, 1);
    const tripData = (!payload.lineLabel && payload.tripId)
      ? await fetchTripById(payload.tripId)
      : null;
    // Só código + nome da linha (sem horário/sentido) — precisa repetir
    // entre excedências da mesma linha em dias/horários diferentes pra
    // virar um ranking com sentido no dashboard.
    const linhaStr = (() => {
      const label = payload.lineLabel ?? "";
      if (label) return label;
      if (tripData) return `${tripData.line_code} - ${tripData.line_name}`;
      return "";
    })();

    for (const point of points) {
      await notifyAppsScriptExcesso({
        chave: `${payload.vehicleNumber}|${payload.eventDate} ${point.startTime}`,
        data: payload.eventDate,
        veiculo: payload.vehicleNumber,
        linha: linhaStr,
        ponto: point.place || "—",
        cidade: point.cidade ?? "",
        uf: point.uf ?? "",
        regiao: point.regiao ?? "",
        motorista: driver1Snapshot?.name ?? "",
        motoristaCodigo: driver1Snapshot?.registry ?? driver1.driverId ?? "",
        entrada: `${payload.eventDate} ${point.startTime}`,
        saida: `${payload.eventDate} ${point.endTime}`,
        permanenciaMin: point.permanenciaMin ?? 0,
        permitidoMin: point.permitidoMin ?? 0,
        excedenteMin: point.excedenteMin ?? 0,
        occurrenceId: id,
        lat: point.lat ?? null,
        lng: point.lng ?? null,
      });
    }
  }

  return paradaForaIds.length > 0 ? { id, paradaForaIds } : id;
}

export async function getOccurrencesByDay(date: string) {
  return listOccurrencesByDay(date);
}

function validateDrivers(drivers: any[]) {
  if (!Array.isArray(drivers) || drivers.length === 0) {
    throw new Error("Drivers: informe pelo menos o Motorista 01.");
  }

  const d1 = drivers.find((d) => d?.position === 1);
  if (!d1?.driverId && !d1?.name) throw new Error("Motorista 01: informe driverId ou name.");

  for (const d of drivers) {
    if (d.position !== 1 && d.position !== 2) {
      throw new Error("Drivers: position deve ser 1 ou 2.");
    }
    if (!d.driverId && !d.name) {
      throw new Error(
        `Drivers: informe driverId ou name (position ${d.position}).`,
      );
    }
  }

  const ids = drivers.filter((d) => d.driverId).map((d) => d.driverId);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Drivers: não pode repetir o mesmo motorista.");
  }

  return drivers as Array<{ position: 1 | 2; driverId?: string; name?: string; registry?: string; baseCode?: string }>;
}

export async function updateOccurrence(id: string, payload: any) {
  const typeId = await getTypeIdByCode(payload.typeCode);
  const tripulacaoAtiva = payload.showSectionTripulacao !== false;
  const drivers = tripulacaoAtiva ? validateDrivers(payload.drivers) : [];

  const driver1 = drivers.find((d) => d.position === 1);

  let baseCode = payload.baseCode?.trim() ?? "";
  if (!baseCode && driver1?.driverId) {
    baseCode = (await getDriverBaseById(driver1.driverId)) ?? "";
  }
  if (!baseCode && driver1?.baseCode) {
    baseCode = driver1.baseCode.trim();
  }
  if (!baseCode && tripulacaoAtiva && !driver1?.driverId) {
    baseCode = "GENERICO";
  }
  if (!baseCode && tripulacaoAtiva)
    throw new Error("Não foi possível derivar baseCode do Motorista 01.");
  if (!baseCode) baseCode = "GENERICO";

  // Só reescreve os pontos quando payload.points vem explicitamente — o
  // formulário de edição atual é single-point e não deve apagar um grupo
  // multi-ponto criado pelo fluxo em grupo.
  const points = Array.isArray(payload.points) && payload.points.length > 0
    ? resolvePoints(payload)
    : null;
  const summary = points ? summarizePoints(points) : null;

  await updateOccurrenceData(id, {
    type_id: typeId,
    trip_id: payload.tripId ?? null,
    event_date: payload.eventDate,
    trip_date: payload.tripDate,
    start_time: summary?.startTime ?? payload.startTime,
    end_time: summary?.endTime ?? payload.endTime,
    vehicle_number: payload.vehicleNumber,
    base_code: baseCode,
    line_label: payload.lineLabel ?? null,
    place: summary?.place ?? payload.place ?? "",
    speed_kmh: payload.speedKmh ?? null,
    trip_time: payload.tripTime || null,
    session_time: payload.sessionTime || null,
    occurrence_name: payload.occurrenceName ?? null,
    report_title: payload.reportTitle ?? null,
    cco_operator: payload.ccoOperator ?? null,
    vehicle_km: payload.vehicleKm ?? null,
    passenger_count: payload.passengerCount ?? null,
    passenger_connection: payload.passengerConnection ?? null,
    relato_html: payload.relatoHtml ?? null,
    devolutiva_html: payload.devolutivaHtml ?? null,
    devolutiva_status: payload.devolutivaStatus ?? null,
    show_section_viagem: payload.showSectionViagem ?? true,
    show_section_identificacao: payload.showSectionIdentificacao ?? true,
    show_section_dados: payload.showSectionDados ?? true,
    show_section_tripulacao: payload.showSectionTripulacao ?? true,
    show_section_passageiros: payload.showSectionPassageiros ?? true,
    devolutiva_before_evidences: payload.devolutivaBeforeEvidences ?? false,
    tratativa: payload.tratativa ?? null,
    analisado_por: payload.analisadoPor ?? null,
  });

  await insertDrivers(id, drivers);

  if (points) {
    await insertPoints(id, points);
  }

  const snapshotBase = await getBaseCodeFromOccurrenceDriver(id);
  if (snapshotBase && snapshotBase !== baseCode) {
    await updateOccurrenceBaseCode(id, snapshotBase);
  }

  // Notifica planilha apenas para ocorrências de Parada Fora do Programado
  if (payload.typeCode === "DESCUMP_OP_PARADA_FORA" && driver1) {
    const driver1Snapshot = await getDriverSnapshotByOccurrence(id, 1);
    const driver2 = drivers.find((d) => d.position === 2);
    const localIdNum = payload.placeCode
      ? null
      : await getLocalIdByNome(payload.place);
    const localIdStr = payload.placeCode
      ? String(payload.placeCode)
      : localIdNum
        ? String(localIdNum)
        : "0"; // fallback: Apps Script valida campo não-vazio; 0 sinaliza "local não mapeado"
    const driverBase = driver1.driverId ? await getDriverBaseById(driver1.driverId) : undefined;
    const tripData = (!payload.lineLabel && payload.tripId)
      ? await fetchTripById(payload.tripId)
      : null;
    const linhaStr = (() => {
      const label = payload.lineLabel ?? "";
      let code: string, route: string;
      if (label) {
        const dashIdx = label.indexOf(" - ");
        code  = dashIdx >= 0 ? label.slice(0, dashIdx) : label;
        route = dashIdx >= 0 ? label.slice(dashIdx + 3) : "";
      } else if (tripData) {
        code  = tripData.line_code;
        route = tripData.line_name;
      } else {
        return "";
      }
      const time    = payload.tripTime    ?? tripData?.departure_time ?? "";
      const sentido = payload.tripSentido ?? tripData?.direction      ?? "";
      return [code, route, time, sentido].join("|");
    })();

    await notifyAppsScript({
      localId: localIdStr,
      localNome: payload.place || "—",
      carro: payload.vehicleNumber,
      motoristaId: driver1Snapshot?.registry ?? driver1.driverId,
      motoristaNome: driver1Snapshot?.name ?? "",
      base: driver1Snapshot?.base_code || driverBase || baseCode,
      dataRelatorio: payload.eventDate,
      linha: linhaStr,
    });

    if (driver2) {
      const driver2Snapshot = await getDriverSnapshotByOccurrence(id, 2);
      const driver2Base = driver2.driverId ? await getDriverBaseById(driver2.driverId) : undefined;

      await notifyAppsScript({
        localId: localIdStr,
        localNome: payload.place || "—",
        carro: payload.vehicleNumber,
        motoristaId: driver2Snapshot?.registry ?? driver2.driverId,
        motoristaNome: driver2Snapshot?.name ?? "",
        base: driver2Snapshot?.base_code || driver2Base || baseCode,
        dataRelatorio: payload.eventDate,
        linha: linhaStr,
      });
    }
  }

  return id;
}
