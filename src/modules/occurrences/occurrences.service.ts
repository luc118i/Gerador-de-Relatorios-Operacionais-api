// occurrences.service.ts
import {
  getTypeIdByCode,
  insertDrivers,
  insertOccurrence,
  listOccurrencesByDay,
} from "./occurrences.repo";

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

export async function createOccurrence(payload: any) {
  const typeId = await getTypeIdByCode(payload.typeCode);

  const id = await insertOccurrence({
    type_id: typeId,
    event_date: payload.eventDate,
    trip_date: payload.tripDate,
    start_time: payload.startTime,
    end_time: payload.endTime,
    vehicle_number: payload.vehicleNumber,
    base_code: payload.baseCode,
    line_label: payload.lineLabel ?? null,
    place: payload.place,
  });

  const drivers = validateDrivers(payload.drivers);
  await insertDrivers(id, drivers);

  return id;
}

export async function getOccurrencesByDay(date: string) {
  return listOccurrencesByDay(date);
}
