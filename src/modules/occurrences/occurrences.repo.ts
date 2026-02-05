import { supabaseAdmin } from "../../core/infra/supabaseAdmin";

export async function getTypeIdByCode(code: string) {
  const { data, error } = await supabaseAdmin
    .from("occurrence_types")
    .select("id")
    .eq("code", code)
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function insertOccurrence(data: any) {
  const { data: row, error } = await supabaseAdmin
    .from("occurrences")
    .insert(data)
    .select("id")
    .single();

  if (error) throw error;
  return row.id;
}

export async function insertDrivers(occurrenceId: string, drivers: any[]) {
  await supabaseAdmin
    .from("occurrence_drivers")
    .delete()
    .eq("occurrence_id", occurrenceId);

  const { error } = await supabaseAdmin.from("occurrence_drivers").insert(
    drivers.map((d) => ({
      occurrence_id: occurrenceId,
      position: d.position,
      registry: d.registry,
      name: d.name,
      base_code: d.baseCode,
    })),
  );

  if (error) throw error;
}

/** NOVO: listar por dia com drivers + evidences (count) + type */
export async function listOccurrencesByDay(date: string) {
  const { data, error } = await supabaseAdmin
    .from("occurrences")
    .select(
      `
      id,
      event_date,
      trip_date,
      start_time,
      end_time,
      vehicle_number,
      base_code,
      line_label,
      place,
      created_at,
      occurrence_types:occurrence_types (code, title),
      occurrence_drivers (position, registry, name, base_code),
      occurrence_evidences (id)
    `,
    )
    .eq("event_date", date)
    .order("start_time", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((o: any) => ({
    id: o.id,
    typeCode: o.occurrence_types?.code ?? null,
    typeTitle: o.occurrence_types?.title ?? null,
    eventDate: o.event_date,
    tripDate: o.trip_date,
    startTime: o.start_time?.slice(0, 5),
    endTime: o.end_time?.slice(0, 5),
    vehicleNumber: o.vehicle_number,
    baseCode: o.base_code,
    lineLabel: o.line_label,
    place: o.place,
    createdAt: o.created_at,
    drivers: (o.occurrence_drivers ?? []).sort(
      (a: any, b: any) => a.position - b.position,
    ),
    evidenceCount: (o.occurrence_evidences ?? []).length,
  }));
}
