// occurrences.repo.ts
import { supabaseAdmin } from "../../core/infra/supabaseAdmin.js";
import { deleteStorageFile } from "../reports/pdf/pdf.storage.js";

const REPORTS_BUCKET = process.env.SUPABASE_REPORTS_BUCKET ?? "reports";

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

type DriverLink = {
  position: 1 | 2;
  driverId?: string;
  name?: string;
  registry?: string;
  baseCode?: string;
};

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

  // sem motoristas (seção desabilitada) — apenas limpa e sai
  if (drivers.length === 0) return;

  // insere vínculos: com driverId → trigger preenche snapshot; sem driverId → inline
  const { error: insErr } = await supabaseAdmin
    .from("occurrence_drivers")
    .insert(
      drivers.map((d) => {
        const row: Record<string, unknown> = {
          occurrence_id: occurrenceId,
          position: d.position,
        };
        if (d.driverId) {
          row.driver_id = d.driverId;
        } else {
          row.name      = d.name      ?? null;
          row.registry  = d.registry  ?? null;
          row.base_code = d.baseCode  ?? null;
        }
        return row;
      }),
    );

  if (insErr) throw insErr;
}

type OccurrencePointInput = {
  place: string;
  startTime: string;
  endTime: string;
  cidade?: string;
  uf?: string;
  regiao?: string;
  permanenciaMin?: number;
  permitidoMin?: number;
  excedenteMin?: number;
  lat?: number | null;
  lng?: number | null;
};

/** Substitui os pontos de parada de uma ocorrência EXCESSO_PERMANENCIA
 * (mesmo padrão de insertDrivers: apaga os antigos e insere os novos). */
export async function insertPoints(
  occurrenceId: string,
  points: OccurrencePointInput[],
) {
  const { error: delErr } = await supabaseAdmin
    .from("occurrence_points")
    .delete()
    .eq("occurrence_id", occurrenceId);

  if (delErr) throw delErr;

  if (points.length === 0) return;

  const { error: insErr } = await supabaseAdmin
    .from("occurrence_points")
    .insert(
      points.map((p, i) => ({
        occurrence_id: occurrenceId,
        seq: i + 1,
        place: p.place,
        start_time: p.startTime,
        end_time: p.endTime,
        cidade: p.cidade ?? null,
        uf: p.uf ?? null,
        regiao: p.regiao ?? null,
        permanencia_min: p.permanenciaMin ?? null,
        permitido_min: p.permitidoMin ?? null,
        excedente_min: p.excedenteMin ?? null,
        lat: p.lat ?? null,
        lng: p.lng ?? null,
      })),
    );

  if (insErr) throw insErr;
}

export async function listPointsByOccurrence(occurrenceId: string) {
  const { data, error } = await supabaseAdmin
    .from("occurrence_points")
    .select("place, start_time, end_time, cidade, uf, regiao, permanencia_min, permitido_min, excedente_min, lat, lng")
    .eq("occurrence_id", occurrenceId)
    .order("seq", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((p: any) => ({
    place: p.place,
    startTime: p.start_time,
    endTime: p.end_time,
    cidade: p.cidade ?? null,
    uf: p.uf ?? null,
    regiao: p.regiao ?? null,
    permanenciaMin: p.permanencia_min ?? null,
    permitidoMin: p.permitido_min ?? null,
    excedenteMin: p.excedente_min ?? null,
    lat: p.lat ?? null,
    lng: p.lng ?? null,
  }));
}

function mapPointRows(rows: any): Array<{
  place: string;
  startTime: string;
  endTime: string;
  permanenciaMin: number | null;
  permitidoMin: number | null;
  excedenteMin: number | null;
}> {
  return (Array.isArray(rows) ? rows : [])
    .sort((a: any, b: any) => a.seq - b.seq)
    .map((p: any) => ({
      place: p.place,
      startTime: p.start_time,
      endTime: p.end_time,
      permanenciaMin: p.permanencia_min ?? null,
      permitidoMin: p.permitido_min ?? null,
      excedenteMin: p.excedente_min ?? null,
    }));
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
      trip_time,
      session_time,
      occurrence_name,
      report_title,
      cco_operator,
      vehicle_km,
      passenger_count,
      passenger_connection,
      relato_html,
      devolutiva_html,
      devolutiva_status,
      show_section_viagem,
      show_section_identificacao,
      show_section_dados,
      show_section_tripulacao,
      show_section_passageiros,
      devolutiva_before_evidences,
      rizer_registered,
      drive_file_nome,
      drive_web_view_link,
      advertencia,
      suspensao,
      falta_tratativa,
      tratativa,
      analisado_por,
      analisado_por_user_id,
      justificativa_registro,
      whatsapp_sent_count_1,
      whatsapp_last_sent_1_at,
      whatsapp_sent_count_2,
      whatsapp_last_sent_2_at,
      created_at,
      occurrence_types:occurrence_types (code, title),
      occurrence_drivers (position, driver_id, registry, name, base_code),
      occurrence_evidences (id),
      occurrence_points (seq, place, start_time, end_time, permanencia_min, permitido_min, excedente_min),
      suspensoes (data_inicio, dias)
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
    // Viagem canônica (join trips por trip_id). O sentido vem daqui, não do nome.
    tripLineCode: o.trip?.line_code ?? null,
    tripLineName: o.trip?.line_name ?? null,
    tripDirection: o.trip?.direction ?? null,
    startTime: o.start_time?.slice(0, 5),
    endTime: o.end_time?.slice(0, 5),
    vehicleNumber: o.vehicle_number,
    baseCode: o.base_code,
    lineLabel: o.line_label,
    place: o.place,
    speedKmh: o.speed_kmh ?? null,
    tripTime: o.trip_time ?? null,
    sessionTime: o.session_time ?? null,
    occurrenceName: o.occurrence_name ?? null,
    reportTitle: o.report_title ?? null,
    ccoOperator: o.cco_operator ?? null,
    vehicleKm: o.vehicle_km ?? null,
    passengerCount: o.passenger_count ?? null,
    passengerConnection: o.passenger_connection ?? null,
    relatoHtml: o.relato_html ?? null,
    devolutivaHtml: o.devolutiva_html ?? null,
    devolutivaStatus: o.devolutiva_status ?? null,
    showSectionViagem: o.show_section_viagem ?? true,
    showSectionIdentificacao: o.show_section_identificacao ?? true,
    showSectionDados: o.show_section_dados ?? true,
    showSectionTripulacao: o.show_section_tripulacao ?? true,
    showSectionPassageiros: o.show_section_passageiros ?? true,
    devolutivaBeforeEvidences: o.devolutiva_before_evidences ?? false,
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
    points: mapPointRows(o.occurrence_points),
    suspensao: (() => {
      const arr = Array.isArray(o.suspensoes) ? o.suspensoes : [];
      const s = arr[0] ?? null;
      return s ? { dataInicio: s.data_inicio as string, dias: s.dias as number } : null;
    })(),
    rizerRegistered: o.rizer_registered ?? false,
    driveFileNome: o.drive_file_nome ?? null,
    driveWebViewLink: o.drive_web_view_link ?? null,
    advertencia: o.advertencia ?? true,
    suspensaoDisciplinar: o.suspensao ?? false,
    faltaTratativa: o.falta_tratativa ?? false,
    tratativa: o.tratativa ?? null,
    analisadoPor: o.analisado_por ?? null,
    analisadoPorUserId: o.analisado_por_user_id ?? null,
    justificativaRegistro: o.justificativa_registro ?? null,
    whatsappSentCountD1: o.whatsapp_sent_count_1 ?? 0,
    whatsappLastSentD1At: o.whatsapp_last_sent_1_at ?? null,
    whatsappSentCountD2: o.whatsapp_sent_count_2 ?? 0,
    whatsappLastSentD2At: o.whatsapp_last_sent_2_at ?? null,
  }));
}

export async function getBaseCodeFromOccurrenceDriver(occurrenceId: string) {
  const { data, error } = await supabaseAdmin
    .from("occurrence_drivers")
    .select("base_code, position")
    .eq("occurrence_id", occurrenceId)
    .eq("position", 1)
    .maybeSingle();

  if (error) throw error;
  return (data?.base_code ?? "").trim() || null;
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
      occurrence_name,
      report_title,
      cco_operator,
      vehicle_km,
      passenger_count,
      passenger_connection,
      relato_html,
      devolutiva_html,
      devolutiva_status,
      show_section_viagem,
      show_section_identificacao,
      show_section_dados,
      show_section_tripulacao,
      show_section_passageiros,
      devolutiva_before_evidences,
      trip_time,
      session_time,
      created_at,
      rizer_registered,
      rizer_id,
      drive_file_nome,
      advertencia,
      suspensao,
      falta_tratativa,
      tratativa,
      analisado_por,
      analisado_por_user_id,
      whatsapp_sent_count_1,
      whatsapp_last_sent_1_at,
      whatsapp_sent_count_2,
      whatsapp_last_sent_2_at,
      occurrence_types:occurrence_types (code, title),
      occurrence_drivers (position, driver_id, registry, name, base_code),
      occurrence_evidences (id, storage_path, caption, link_texto, link_url, sort_order),
      occurrence_points (seq, place, start_time, end_time, permanencia_min, permitido_min, excedente_min),
      suspensoes (data_inicio, dias)
    `,
    )
    .eq("id", id)
    .single();

  if (error) throw error;

  const o: any = data;

  // Viagem canônica (código/nome/sentido) — busca separada por trip_id para não
  // depender de FK/embed do PostgREST. O sentido é servido daqui, não do nome.
  if (o.trip_id) {
    const { data: t } = await supabaseAdmin
      .from("trips")
      .select("line_code, line_name, direction")
      .eq("id", o.trip_id)
      .maybeSingle();
    o.trip = t ?? null;
  }

  return {
    id: o.id,
    typeCode: o.occurrence_types?.code ?? null,
    typeTitle: o.occurrence_types?.title ?? null,
    eventDate: o.event_date,
    tripDate: o.trip_date,
    tripId: o.trip_id ?? null,
    // Viagem canônica (join trips por trip_id). O sentido vem daqui, não do nome.
    tripLineCode: o.trip?.line_code ?? null,
    tripLineName: o.trip?.line_name ?? null,
    tripDirection: o.trip?.direction ?? null,
    startTime: o.start_time?.slice(0, 5),
    endTime: o.end_time?.slice(0, 5),
    vehicleNumber: o.vehicle_number,
    baseCode: o.base_code,
    lineLabel: o.line_label,
    place: o.place,
    speedKmh: o.speed_kmh ?? null,
    tripTime: o.trip_time ?? null,
    sessionTime: o.session_time ?? null,
    occurrenceName: o.occurrence_name ?? null,
    reportTitle: o.report_title ?? null,
    ccoOperator: o.cco_operator ?? null,
    vehicleKm: o.vehicle_km ?? null,
    passengerCount: o.passenger_count ?? null,
    passengerConnection: o.passenger_connection ?? null,
    relatoHtml: o.relato_html ?? null,
    devolutivaHtml: o.devolutiva_html ?? null,
    devolutivaStatus: o.devolutiva_status ?? null,
    showSectionViagem: o.show_section_viagem ?? true,
    showSectionIdentificacao: o.show_section_identificacao ?? true,
    showSectionDados: o.show_section_dados ?? true,
    showSectionTripulacao: o.show_section_tripulacao ?? true,
    showSectionPassageiros: o.show_section_passageiros ?? true,
    devolutivaBeforeEvidences: o.devolutiva_before_evidences ?? false,
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
    points: mapPointRows(o.occurrence_points),
    // evidências completas
    evidences: (o.occurrence_evidences ?? [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((e: any) => ({
        id: e.id,
        storagePath: e.storage_path,
        caption: e.caption ?? "",
        linkTexto: e.link_texto ?? "",
        linkUrl: e.link_url ?? "",
      })),
    rizerRegistered: o.rizer_registered ?? false,
    rizerId: o.rizer_id ?? null,
    driveFileNome: o.drive_file_nome ?? null,
    driveWebViewLink: o.drive_web_view_link ?? null,
    advertencia: o.advertencia ?? true,
    suspensaoDisciplinar: o.suspensao ?? false,
    faltaTratativa: o.falta_tratativa ?? false,
    tratativa: o.tratativa ?? null,
    analisadoPor: o.analisado_por ?? null,
    analisadoPorUserId: o.analisado_por_user_id ?? null,
    whatsappSentCountD1: o.whatsapp_sent_count_1 ?? 0,
    whatsappLastSentD1At: o.whatsapp_last_sent_1_at ?? null,
    whatsappSentCountD2: o.whatsapp_sent_count_2 ?? 0,
    whatsappLastSentD2At: o.whatsapp_last_sent_2_at ?? null,
    suspensao: (() => {
      const arr = Array.isArray(o.suspensoes) ? o.suspensoes : []
      const s = arr[0] ?? null
      return s ? { dataInicio: s.data_inicio as string, dias: s.dias as number } : null
    })(),
  };
}

// Contador de envios de notificação via WhatsApp por motorista (posição 1
// ou 2) — usado pelo botão de WhatsApp na Home/preview pra virar um
// contador em vez de resetar a cada envio. Incremento atômico via função
// no banco (increment_whatsapp_sent, ver migration add_whatsapp_sent_tracking.sql).
export async function incrementWhatsappSent(
  occurrenceId: string,
  position: 1 | 2,
): Promise<{ count: number; lastSentAt: string }> {
  const { data, error } = await supabaseAdmin.rpc("increment_whatsapp_sent", {
    p_occurrence_id: occurrenceId,
    p_position: position,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return { count: row.count as number, lastSentAt: row.last_sent_at as string };
}

export async function markRizerRegistered(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('occurrences')
    .update({ rizer_registered: true })
    .eq('id', id)
  if (error) throw error
}

export async function saveRizerData(id: string, data: {
  rizerId?: string | null
  driveFileNome?: string | null
  driveWebViewLink?: string | null
}): Promise<void> {
  const update: Record<string, unknown> = {}
  if (data.rizerId !== undefined)          update.rizer_id             = data.rizerId
  if (data.driveFileNome !== undefined)    update.drive_file_nome      = data.driveFileNome
  if (data.driveWebViewLink !== undefined) update.drive_web_view_link  = data.driveWebViewLink

  if (Object.keys(update).length === 0) return

  const { error } = await supabaseAdmin
    .from('occurrences')
    .update(update)
    .eq('id', id)
  if (error) throw error
}

// Extrai o ID do arquivo de um link do Google Drive, em qualquer formato
// (/file/d/ID/view, ?id=ID, ou o ID puro). O mesmo arquivo pode aparecer com
// query strings diferentes (?usp=drivesdk salvo automaticamente pelo upload
// x ?usp=sharing quando alguém recopia o link pela UI do Drive) — o ID é a
// única parte estável entre elas.
function extractDriveFileId(url: string): string | null {
  const s = (url || '').trim()
  const m = s.match(/\/d\/([-\w]{20,})/) || s.match(/[?&]id=([-\w]{20,})/)
  if (m && m[1]) return m[1]
  if (/^[-\w]{20,}$/.test(s)) return s
  return null
}

// Busca leve: dado o link do Drive salvo em saveRizerData (drive_web_view_link),
// devolve só o essencial pra quem consome de fora (ex.: painel do Notion) —
// motorista(s) e base, sem trazer o registro inteiro.
// Usada pelo painel de ocorrências (Google Apps Script) para completar
// motorista/base quando o campo "Arquivo" no Notion guarda só o link do
// relatório, sem a matrícula/nome do motorista.
// Casa pelo ID do arquivo (ver extractDriveFileId), não pela URL inteira —
// o mesmo arquivo pode ter query strings diferentes dependendo de como o
// link foi copiado.
export async function getOccurrenceByDriveLink(driveLink: string) {
  const fileId = extractDriveFileId(driveLink)
  if (!fileId) return null

  const { data, error } = await supabaseAdmin
    .from('occurrences')
    .select(
      `
      id,
      base_code,
      vehicle_number,
      occurrence_drivers (position, name, registry, base_code)
      `,
    )
    .ilike('drive_web_view_link', `%${fileId}%`)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const drivers = ((data as any).occurrence_drivers ?? [])
    .sort((a: any, b: any) => a.position - b.position)
    .map((d: any) => ({
      position: d.position,
      name: d.name,
      registry: d.registry,
      baseCode: d.base_code,
    }))

  return {
    id: (data as any).id as string,
    vehicleNumber: (data as any).vehicle_number as string | null,
    baseCode: (data as any).base_code as string | null,
    drivers,
  }
}

export async function markSuspensaoFlags(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('occurrences')
    .update({ advertencia: false, suspensao: true })
    .eq('id', id)
  if (error) throw error
}

export async function markFaltaTratativa(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('occurrences')
    .update({ falta_tratativa: true })
    .eq('id', id)
  if (error) throw error
}

export async function clearFaltaTratativa(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('occurrences')
    .update({ falta_tratativa: false })
    .eq('id', id)
  if (error) throw error
}

export async function countFaltaTratativa(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('occurrences')
    .select('*', { count: 'exact', head: true })
    .eq('falta_tratativa', true)
  if (error) throw error
  return count ?? 0
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

  // Remove o arquivo físico do Storage para invalidar o cache do PDF
  await deleteStorageFile(REPORTS_BUCKET, `occurrences/${id}/report.pdf`);
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
      trip_time: data.trip_time ?? null,
      session_time: data.session_time ?? null,
      report_title: data.report_title ?? null,
      cco_operator: data.cco_operator ?? null,
      vehicle_km: data.vehicle_km ?? null,
      passenger_count: data.passenger_count ?? null,
      passenger_connection: data.passenger_connection ?? null,
      relato_html: data.relato_html ?? null,
      devolutiva_html: data.devolutiva_html ?? null,
      devolutiva_status: data.devolutiva_status ?? null,
      show_section_viagem: data.show_section_viagem ?? true,
      show_section_identificacao: data.show_section_identificacao ?? true,
      show_section_dados: data.show_section_dados ?? true,
      show_section_tripulacao: data.show_section_tripulacao ?? true,
      show_section_passageiros: data.show_section_passageiros ?? true,
      devolutiva_before_evidences: data.devolutiva_before_evidences ?? false,
      tratativa: data.tratativa ?? null,
      analisado_por: data.analisado_por ?? null,
      analisado_por_user_id: data.analisado_por_user_id ?? null,
      pdf_url: null,
      pdf_expires_at: null,
    })
    .eq("id", id);

  if (error) {
    console.error("Erro Supabase:", error.message);
    throw error;
  }

  // Remove o arquivo físico do Storage para invalidar o cache do PDF
  await deleteStorageFile(REPORTS_BUCKET, `occurrences/${id}/report.pdf`);
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
  const normalizado = nome.trim();

  // 1) Exact match
  const { data: exact } = await supabaseAdmin
    .from("locais")
    .select("id")
    .eq("nome", normalizado)
    .maybeSingle();
  if (exact?.id) return exact.id as number;

  // 2) Case-insensitive
  const { data: ci } = await supabaseAdmin
    .from("locais")
    .select("id")
    .ilike("nome", normalizado)
    .maybeSingle();
  if (ci?.id) return ci.id as number;

  // 3) Fuzzy: busca pelo primeiro token significativo (sem strip no ilike — o banco tem pontuação),
  //    depois pontua candidatos por sobreposição de palavras (strip em ambos os lados)
  const tokens = normalizado.toLowerCase().split(/[\s.,\-\/\\]+/).filter((w) => w.length > 2);
  if (tokens.length === 0) return null;

  const { data: fuzzy, error: fuzzyErr } = await supabaseAdmin
    .from("locais")
    .select("id, nome")
    .ilike("nome", `%${tokens[0]}%`)
    .limit(10);

  if (!fuzzyErr && fuzzy?.length) {
    const inputWords = new Set(tokens);
    const scored = fuzzy.map((r: any) => {
      const rWords = (r.nome as string).toLowerCase().split(/[\s.,\-\/\\]+/).filter((w: string) => w.length > 0);
      const hits = rWords.filter((w: string) => inputWords.has(w)).length;
      return { id: r.id, hits };
    });
    scored.sort((a: any, b: any) => b.hits - a.hits);
    const best = scored[0];
    if (best && best.hits >= 2) return best.id as number;
  }

  return null;
}
export async function deleteOccurrence(id: string) {
  const { error } = await supabaseAdmin
    .from("occurrences")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// Mapeia o valor legado de `tratativa` pro enum medida_tipo de
// occurrence_measures (ver migration do módulo disciplinary).
const TRATATIVA_TO_MEDIDA: Record<string, string> = {
  SUSPEICAO: "SUSPENSAO",
  ADVERTENCIA: "ADVERTENCIA",
  VALE: "VALE",
  REGISTRO: "REGISTRO",
};

export async function updateTratativa(
  id: string,
  tratativa: string | null,
  analisadoPor: string | null,
  justificativaRegistro?: string | null,
  // `undefined` = chamador não sabe desse campo, não mexe no que já está
  // gravado; `null` explícito = limpa o vínculo de propósito.
  analisadoPorUserId?: string | null,
): Promise<void> {
  const metaUpdate: Record<string, unknown> = {
    analisado_por: analisadoPor ?? null,
    justificativa_registro: justificativaRegistro ?? null,
  };
  if (analisadoPorUserId !== undefined) {
    metaUpdate.analisado_por_user_id = analisadoPorUserId;
  }

  if (tratativa === null) {
    // Limpar tratativa não é uma "medida" a registrar — occurrence_measures
    // é append-only (histórico), então isso continua sendo update direto.
    const { error } = await supabaseAdmin
      .from("occurrences")
      .update({ tratativa: null, ...metaUpdate })
      .eq("id", id);
    if (error) throw error;
    return;
  }

  const tipo = TRATATIVA_TO_MEDIDA[tratativa];
  if (!tipo) throw new Error(`tratativa desconhecida: ${tratativa}`);

  // Motoristas vinculados a essa ocorrência (1 ou 2, ver OccurrenceDriverDTO.position).
  const { data: linked, error: linkedError } = await supabaseAdmin
    .from("occurrence_drivers")
    .select("driver_id")
    .eq("occurrence_id", id);
  if (linkedError) throw linkedError;

  if (linked && linked.length > 0) {
    // Fonte única de verdade agora é occurrence_measures — o trigger
    // trg_sync_tratativa reflete em occurrences.tratativa automaticamente.
    const rows = linked.map((d) => ({
      occurrence_id: id,
      driver_id: d.driver_id,
      tipo,
      responsavel: analisadoPor?.trim() || "sistema",
      observacao: justificativaRegistro ?? null,
    }));
    const { error: insertError } = await supabaseAdmin
      .from("occurrence_measures")
      .insert(rows);
    if (insertError) throw insertError;
  } else {
    // Sem motorista vinculado (não deveria acontecer) — sem driver_id não dá
    // pra gravar em occurrence_measures (coluna NOT NULL), cai no update direto.
    metaUpdate.tratativa = tratativa;
  }

  // Campos que o trigger não cobre (analisado_por/justificativa/user_id), e
  // cobre o fallback acima quando não havia driver vinculado.
  const { error } = await supabaseAdmin
    .from("occurrences")
    .update(metaUpdate)
    .eq("id", id);
  if (error) throw error;
}

export async function listReportTitles(): Promise<string[]> {
  const { data: typeRow } = await supabaseAdmin
    .from("occurrence_types")
    .select("id")
    .eq("code", "GENERICO")
    .maybeSingle();

  if (!typeRow) return [];

  const { data, error } = await supabaseAdmin
    .from("occurrences")
    .select("report_title, created_at")
    .eq("type_id", typeRow.id)
    .not("report_title", "is", null)
    .neq("report_title", "")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[listReportTitles]", error.message);
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const row of (data ?? [])) {
    const title = String(row.report_title ?? "").trim().toUpperCase();
    if (title && !seen.has(title)) {
      seen.add(title);
      result.push(title);
    }
  }
  return result; // already ordered most-recent → oldest
}
