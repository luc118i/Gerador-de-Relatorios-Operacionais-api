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
  const startUTC = new Date(`${date}T00:00:00`).toISOString(); // Converte para UTC
  const endUTC = new Date(`${date}T23:59:59`).toISOString(); // Converte para UTC

  const { data, error } = await supabaseAdmin
    .from("occurrences")
    .select(
      `
      id,
      event_date,
      trip_date,
      trip_id,
      start_time,
      end_time,
      vehicle_number,
      base_code,
      line_label,
      place,
      speed_kmh,
      report_title,
      cco_operator,
      vehicle_km,
      passenger_count,
      passenger_connection,
      relato_html,
      devolutiva_html,
      devolutiva_status,
      created_at,
      occurrence_types:occurrence_types (code, title),
      occurrence_drivers (position, driver_id, registry, name, base_code),
      occurrence_evidences (id)
    `,
    )
    .gte("created_at", startUTC) // Utiliza UTC para a consulta
    .lte("created_at", endUTC)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((o: any) => ({
    id: o.id,
    typeCode: o.occurrence_types?.code ?? null,
    typeTitle: o.occurrence_types?.title ?? null,
    eventDate: o.event_date,
    tripDate: o.trip_date,
    tripId: o.trip_id ?? null,
    startTime: o.start_time?.slice(0, 5),
    endTime: o.end_time?.slice(0, 5),
    vehicleNumber: o.vehicle_number,
    baseCode: o.base_code,
    lineLabel: o.line_label,
    place: o.place,
    speedKmh: o.speed_kmh ?? null,
    reportTitle: o.report_title ?? null,
    ccoOperator: o.cco_operator ?? null,
    vehicleKm: o.vehicle_km ?? null,
    passengerCount: o.passenger_count ?? null,
    passengerConnection: o.passenger_connection ?? null,
    relatoHtml: o.relato_html ?? null,
    devolutivaHtml: o.devolutiva_html ?? null,
    devolutivaStatus: o.devolutiva_status ?? null,
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
      trip_id,
      start_time,
      end_time,
      vehicle_number,
      base_code,
      line_label,
      place,
      speed_kmh,
      report_title,
      cco_operator,
      vehicle_km,
      passenger_count,
      passenger_connection,
      relato_html,
      devolutiva_html,
      devolutiva_status,
      created_at,
      occurrence_types:occurrence_types (code, title),
      occurrence_drivers (position, driver_id, registry, name, base_code),
      occurrence_evidences (id, storage_path, caption, link_texto, link_url, sort_order)
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
    tripId: o.trip_id ?? null,
    startTime: o.start_time?.slice(0, 5),
    endTime: o.end_time?.slice(0, 5),
    vehicleNumber: o.vehicle_number,
    baseCode: o.base_code,
    lineLabel: o.line_label,
    place: o.place,
    speedKmh: o.speed_kmh ?? null,
    reportTitle: o.report_title ?? null,
    ccoOperator: o.cco_operator ?? null,
    vehicleKm: o.vehicle_km ?? null,
    passengerCount: o.passenger_count ?? null,
    passengerConnection: o.passenger_connection ?? null,
    relatoHtml: o.relato_html ?? null,
    devolutivaHtml: o.devolutiva_html ?? null,
    devolutivaStatus: o.devolutiva_status ?? null,
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
    // ✅ evidências completas
    evidences: (o.occurrence_evidences ?? [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((e: any) => ({
        id: e.id,
        storagePath: e.storage_path,
        caption: e.caption ?? "",
        linkTexto: e.link_texto ?? "",
        linkUrl: e.link_url ?? "",
      })),
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
      trip_id: data.trip_id ?? null,
      place: data.place,
      speed_kmh: data.speed_kmh ?? null,
      report_title: data.report_title ?? null,
      cco_operator: data.cco_operator ?? null,
      vehicle_km: data.vehicle_km ?? null,
      passenger_count: data.passenger_count ?? null,
      passenger_connection: data.passenger_connection ?? null,
      relato_html: data.relato_html ?? null,
      devolutiva_html: data.devolutiva_html ?? null,
      devolutiva_status: data.devolutiva_status ?? null,
      pdf_url: null,
      pdf_expires_at: null,
    })
    .eq("id", id);

  if (error) {
    console.error("Erro Supabase:", error.message);
    throw error;
  }
}

export async function getDriverSnapshotByOccurrence(
  occurrenceId: string,
  position: 1 | 2 = 1, // ← padrão continua sendo 1, não quebra nada
) {
  const { data, error } = await supabaseAdmin
    .from("occurrence_drivers")
    .select("name, registry, base_code")
    .eq("occurrence_id", occurrenceId)
    .eq("position", position)
    .single();

  if (error) return null; // retorna null se não achar (motorista 2 é opcional)
  return data;
}

export async function getLocalIdByNome(nome: string) {
  const { data, error } = await supabaseAdmin
    .from("locais")
    .select("id")
    .eq("nome", nome)
    .single();

  if (error) return null; // não quebra se não achar
  return (data?.id as number) ?? null;
}
export async function deleteOccurrence(id: string) {
  const { error } = await supabaseAdmin
    .from("occurrences")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
