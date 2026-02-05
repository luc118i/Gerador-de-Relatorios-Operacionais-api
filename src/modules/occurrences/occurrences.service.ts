import {
  getTypeIdByCode,
  insertDrivers,
  insertOccurrence,
  listOccurrencesByDay,
} from "./occurrences.repo";

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

  await insertDrivers(id, payload.drivers);
  return id;
}

export async function getOccurrencesByDay(date: string) {
  return listOccurrencesByDay(date);
}
