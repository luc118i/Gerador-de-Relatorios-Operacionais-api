// occurrences.repo.ts
import { supabaseAdmin } from "../../core/infra/supabaseAdmin.js";

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

type DriverLink = { position: 1 | 2; driverId: string };

export async function insertDrivers(
  occurrenceId: string,
  drivers: DriverLink[],
) {
  // remove vínculos antigos
  const { error: delErr } = await supabaseAdmin
    .from("occurrence_drivers")
    .delete()
    .eq("occurrence_id", occurrenceId);

  if (delErr) throw delErr;

  // insere vínculos novos (snapshots via trigger)
  const { error: insErr } = await supabaseAdmin
    .from("occurrence_drivers")
    .insert(
      drivers.map((d) => ({
        occurrence_id: occurrenceId,
        position: d.position,
        driver_id: d.driverId,
      })),
    );

  if (insErr) throw insErr;
}

/** listar por dia com drivers + evidences (count) + type */
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
      occurrence_drivers (position, driver_id, registry, name, base_code),
      occurrence_evidences (id)
    `,
    )
    // --- ALTERAÇÃO AQUI ---
    // Em vez de .eq("event_date", date)
    // Filtramos o created_at entre o início e o fim do dia informado
    .gte("created_at", `${date}T00:00:00.000Z`)
    .lte("created_at", `${date}T23:59:59.999Z`)

    // -----------------------
    .order("created_at", { ascending: false }); // Geralmente melhor ver as últimas criadas primeiro

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
    drivers: (o.occurrence_drivers ?? [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((d: any) => ({
        position: d.position,
        driverId: d.driver_id,
        registry: d.registry,
        name: d.name,
        baseCode: d.base_code,
      })),
    evidenceCount: (o.occurrence_evidences ?? []).length,
  }));
}

export async function getBaseCodeFromOccurrenceDriver(occurrenceId: string) {
  const { data, error } = await supabaseAdmin
    .from("occurrence_drivers")
    .select("base_code, position")
    .eq("occurrence_id", occurrenceId)
    .eq("position", 1)
    .single();

  if (error) throw error;
  return (data?.base_code ?? "").trim();
}

export async function updateOccurrenceBaseCode(id: string, baseCode: string) {
  const { error } = await supabaseAdmin
    .from("occurrences")
    .update({ base_code: baseCode })
    .eq("id", id);

  if (error) throw error;
}

export async function getDriverBaseById(driverId: string) {
  const { data, error } = await supabaseAdmin
    .from("drivers")
    .select("base")
    .eq("id", driverId)
    .single();

  if (error) throw error;
  return (data?.base ?? "").trim();
}

export async function getOccurrenceById(id: string) {
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
      occurrence_drivers (position, driver_id, registry, name, base_code),
      occurrence_evidences (id)
    `,
    )
    .eq("id", id)
    .single();

  if (error) throw error;

  const o: any = data;

  return {
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
    drivers: (o.occurrence_drivers ?? [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((d: any) => ({
        position: d.position,
        driverId: d.driver_id,
        registry: d.registry,
        name: d.name,
        baseCode: d.base_code,
      })),
    evidenceCount: (o.occurrence_evidences ?? []).length,
  };
}

export async function updateOccurrence(id: string, data: any) {
  const { error } = await supabaseAdmin
    .from("occurrences")
    .update({
      type_id: data.type_id,
      event_date: data.event_date,
      trip_date: data.trip_date,
      start_time: data.start_time,
      end_time: data.end_time,
      vehicle_number: data.vehicle_number,
      base_code: data.base_code,
      line_label: data.line_label,
      place: data.place,
      // Reseta o PDF para forçar a geração de um novo com os dados atualizados
      pdf_url: null,
      pdf_expires_at: null,
    })
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar ocorrência no banco:", error.message);
    throw error;
  }
}

export async function updateOccurrenceData(id: string, data: any) {
  // Certifique-se de que não existe NADA de "db.query" aqui dentro
  const { error } = await supabaseAdmin
    .from("occurrences")
    .update({
      type_id: data.type_id,
      event_date: data.event_date,
      trip_date: data.trip_date,
      start_time: data.start_time,
      end_time: data.end_time,
      vehicle_number: data.vehicle_number,
      base_code: data.base_code,
      line_label: data.line_label,
      place: data.place,
      pdf_url: null,
      pdf_expires_at: null,
    })
    .eq("id", id);

  if (error) {
    console.error("Erro Supabase:", error.message);
    throw error;
  }
}
