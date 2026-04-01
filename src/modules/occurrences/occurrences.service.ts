import {
  getTypeIdByCode,
  insertOccurrence,
  insertDrivers,
  listOccurrencesByDay,
  getBaseCodeFromOccurrenceDriver,
  updateOccurrenceBaseCode,
  getDriverBaseById,
  updateOccurrenceData,
  getDriverSnapshotByOccurrence,
  getLocalIdByNome,
} from "./occurrences.repo.js";

import { notifyAppsScript } from "../../core/infra/appsScript.service.js";

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
    trip_id: payload.tripId ?? null,
    start_time: payload.startTime,
    end_time: payload.endTime,
    vehicle_number: payload.vehicleNumber,
    base_code: baseCode,
    line_label: payload.lineLabel ?? null,
    place: payload.place ?? "",
    speed_kmh: payload.speedKmh ?? null,
    report_title: payload.reportTitle ?? null,
    cco_operator: payload.ccoOperator ?? null,
    vehicle_km: payload.vehicleKm ?? null,
    passenger_count: payload.passengerCount ?? null,
    passenger_connection: payload.passengerConnection ?? null,
    relato_html: payload.relatoHtml ?? null,
    devolutiva_html: payload.devolutivaHtml ?? null,
    devolutiva_status: payload.devolutivaStatus ?? null,
  });

  // 2) cria vínculos (trigger preenche snapshot)
  await insertDrivers(id, drivers);

  // 3) opcional: se quiser “garantir” que bate com o snapshot do motorista 01
  const snapshotBase = await getBaseCodeFromOccurrenceDriver(id);
  if (snapshotBase && snapshotBase !== baseCode) {
    await updateOccurrenceBaseCode(id, snapshotBase);
  }

  const driver1Snapshot = await getDriverSnapshotByOccurrence(id, 1);
  const driver2 = drivers.find((d) => d.position === 2);
  const localId = await getLocalIdByNome(payload.place);
  const driverBase = await getDriverBaseById(driver1.driverId);

  // motorista 1
  await notifyAppsScript({
    localId: String(localId ?? ""),
    localNome: payload.place,
    carro: payload.vehicleNumber,
    motoristaId: driver1Snapshot?.registry ?? driver1.driverId,
    motoristaNome: driver1Snapshot?.name ?? "",
    base: driver1Snapshot?.base_code || driverBase || baseCode,
    dataRelatorio: payload.eventDate,
  });

  // motorista 2 (se existir)
  if (driver2) {
    const driver2Snapshot = await getDriverSnapshotByOccurrence(id, 2);
    const driver2Base = await getDriverBaseById(driver2.driverId);

    await notifyAppsScript({
      localId: String(localId ?? ""),
      localNome: payload.place,
      carro: payload.vehicleNumber,
      motoristaId: driver2Snapshot?.registry ?? driver2.driverId,
      motoristaNome: driver2Snapshot?.name ?? "",
      base: driver2Snapshot?.base_code || driver2Base || baseCode,
      dataRelatorio: payload.eventDate,
    });
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
  const typeId = await getTypeIdByCode(payload.typeCode);
  const drivers = validateDrivers(payload.drivers);

  const driver1 = drivers.find((d) => d.position === 1);
  if (!driver1) throw new Error("Motorista 01 é obrigatório.");

  const baseCode =
    payload.baseCode?.trim() || (await getDriverBaseById(driver1.driverId));
  if (!baseCode)
    throw new Error("Não foi possível derivar baseCode do Motorista 01.");

  await updateOccurrenceData(id, {
    type_id: typeId,
    trip_id: payload.tripId ?? null,
    event_date: payload.eventDate,
    trip_date: payload.tripDate,
    start_time: payload.startTime,
    end_time: payload.endTime,
    vehicle_number: payload.vehicleNumber,
    base_code: baseCode,
    line_label: payload.lineLabel ?? null,
    place: payload.place ?? "",
    speed_kmh: payload.speedKmh ?? null,
    report_title: payload.reportTitle ?? null,
    cco_operator: payload.ccoOperator ?? null,
    vehicle_km: payload.vehicleKm ?? null,
    passenger_count: payload.passengerCount ?? null,
    passenger_connection: payload.passengerConnection ?? null,
    relato_html: payload.relatoHtml ?? null,
    devolutiva_html: payload.devolutivaHtml ?? null,
    devolutiva_status: payload.devolutivaStatus ?? null,
  });

  await insertDrivers(id, drivers);

  const snapshotBase = await getBaseCodeFromOccurrenceDriver(id);
  if (snapshotBase && snapshotBase !== baseCode) {
    await updateOccurrenceBaseCode(id, snapshotBase);
  }

  return id;
}
