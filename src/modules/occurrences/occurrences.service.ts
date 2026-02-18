import {
  getTypeIdByCode,
  insertOccurrence,
  insertDrivers,
  listOccurrencesByDay,
  getBaseCodeFromOccurrenceDriver,
  updateOccurrenceBaseCode,
  getDriverBaseById,
  updateOccurrenceData,
} from "./occurrences.repo.js";

export async function createOccurrence(payload: any) {
  const typeId = await getTypeIdByCode(payload.typeCode);
  const drivers = validateDrivers(payload.drivers);

  const driver1 = drivers.find((d) => d.position === 1);
  if (!driver1) {
    throw new Error("Motorista 01 é obrigatório.");
  }

  // ✅ baseCode vem do payload OU do driver.base
  const baseCode =
    payload.baseCode?.trim() || (await getDriverBaseById(driver1.driverId));

  if (!baseCode) {
    throw new Error("Não foi possível derivar baseCode do Motorista 01.");
  }

  // 1) cria ocorrência já com base_code válido (não quebra NOT NULL)
  const id = await insertOccurrence({
    type_id: typeId,
    event_date: payload.eventDate,
    trip_date: payload.tripDate,
    start_time: payload.startTime,
    end_time: payload.endTime,
    vehicle_number: payload.vehicleNumber,
    base_code: baseCode,
    line_label: payload.lineLabel ?? null,
    place: payload.place,
  });

  // 2) cria vínculos (trigger preenche snapshot)
  await insertDrivers(id, drivers);

  // 3) opcional: se quiser “garantir” que bate com o snapshot do motorista 01
  const snapshotBase = await getBaseCodeFromOccurrenceDriver(id);
  if (snapshotBase && snapshotBase !== baseCode) {
    await updateOccurrenceBaseCode(id, snapshotBase);
  }

  return id;
}

export async function getOccurrencesByDay(date: string) {
  return listOccurrencesByDay(date);
}

function validateDrivers(drivers: any[]) {
  if (!Array.isArray(drivers) || drivers.length === 0) {
    throw new Error("Drivers: informe pelo menos o Motorista 01.");
  }

  const d1 = drivers.find((d) => d?.position === 1);
  if (!d1?.driverId) throw new Error("Motorista 01 é obrigatório (driverId).");

  for (const d of drivers) {
    if (d.position !== 1 && d.position !== 2) {
      throw new Error("Drivers: position deve ser 1 ou 2.");
    }
    if (!d.driverId) {
      throw new Error(
        `Drivers: driverId é obrigatório (position ${d.position}).`,
      );
    }
  }

  const ids = drivers.map((d) => d.driverId);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Drivers: não pode repetir o mesmo motorista.");
  }

  return drivers as Array<{ position: 1 | 2; driverId: string }>;
}

export async function updateOccurrence(id: string, payload: any) {
  // 1. Validações iniciais (Reaproveita o que você já tem)
  const typeId = await getTypeIdByCode(payload.typeCode);
  const drivers = validateDrivers(payload.drivers);

  const driver1 = drivers.find((d) => d.position === 1);
  if (!driver1) throw new Error("Motorista 01 é obrigatório.");

  // 2. Deriva o baseCode (Mesma lógica da criação)
  const baseCode =
    payload.baseCode?.trim() || (await getDriverBaseById(driver1.driverId));

  if (!baseCode) {
    throw new Error("Não foi possível derivar baseCode do Motorista 01.");
  }

  // 3. O "Coração" da Edição: Atualiza a tabela principal
  // Aqui você deve chamar uma função no repo (que criaremos)
  // que faz o UPDATE e seta o PDF como null
  await updateOccurrenceData(id, {
    type_id: typeId,
    event_date: payload.eventDate,
    trip_date: payload.tripDate,
    start_time: payload.startTime,
    end_time: payload.endTime,
    vehicle_number: payload.vehicleNumber,
    base_code: baseCode,
    line_label: payload.lineLabel ?? null,
    place: payload.place,
    pdf_url: null, // <--- O segredo para forçar a nova geração
  });

  // 4. Sincroniza os Motoristas
  // Sua função 'insertDrivers' já é perfeita: ela deleta os antigos e insere os novos!
  await insertDrivers(id, drivers);

  // 5. Garante o Snapshot (Passo final que você já usa)
  const snapshotBase = await getBaseCodeFromOccurrenceDriver(id);
  if (snapshotBase && snapshotBase !== baseCode) {
    await updateOccurrenceBaseCode(id, snapshotBase);
  }

  return id;
}
