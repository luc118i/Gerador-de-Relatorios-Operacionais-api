import type { AnalysisFullRow } from "../../telemetry/repositories/telemetry-analyses.repo.js";

type Alert = { tipo: string; nivel: string; descricao: string; trecho?: string; velocidadeKmh?: number; distKm?: number; tempoMin?: number };
type Segment = { de: string; para: string; distKm: number | null; tempoMin: number | null; velocidadeKmh: number | null; alertas: Alert[] };
type Point   = { seq: number; ponto: string; entrada: string | null; saida: string | null; parada_s: number; matched: boolean };
type Comparison = { visitados: Array<{ nomePonto: string; horarioRealizado: string | null; desvioMin: number | null }>; naoVisitados: Array<{ nomePonto: string }>; extras: Array<{ ponto: string }> };

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nivelBadge(nivel: string): string {
  const map: Record<string, string> = {
    critical:  "background:#ef4444;color:#fff",
    attention: "background:#f59e0b;color:#fff",
    info:      "background:#3b82f6;color:#fff",
  };
  const style = map[nivel] ?? "background:#6b7280;color:#fff";
  const label: Record<string, string> = { critical: "CRÍTICO", attention: "ATENÇÃO", info: "INFO" };
  return `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;${style}">${label[nivel] ?? esc(nivel)}</span>`;
}

function tipoLabel(tipo: string): string {
  const map: Record<string, string> = {
    VELOCIDADE_BAIXA:     "Vel. Baixa",
    VELOCIDADE_ALTA:      "Vel. Alta",
    VELOCIDADE_EXCESSIVA: "Vel. Excessiva",
    PARADA_PROIBIDA:      "Parada Proibida",
    PARADA_LONGA:         "Parada Longa",
    LOCAL_NAO_IDENTIFICADO: "Local N/Id.",
  };
  return map[tipo] ?? esc(tipo);
}

function fmtMin(min: number | null): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function fmtKm(km: number | null): string {
  return km != null ? `${km.toFixed(1)} km` : "—";
}

function fmtSpeed(v: number | null): string {
  return v != null ? `${v.toFixed(0)} km/h` : "—";
}

function speedColor(v: number | null): string {
  if (v == null) return "#374151";
  if (v > 100) return "#ef4444";
  if (v > 90)  return "#f59e0b";
  return "#374151";
}

export function buildTelemetryReportHtml(row: AnalysisFullRow): string {
  const summary = {
    veiculo:         row.veiculo,
    motorista:       row.motorista,
    dataViagem:      row.data_viagem,
    totalPontos:     row.total_pontos,
    totalKm:         Number(row.total_km),
    tempoTotalMin:   Number(row.tempo_total_min),
    velocidadeMedia: Number(row.velocidade_media),
    totalAlertas:    row.total_alertas,
    alertasCriticos: row.alertas_criticos,
    pontosNaoId:     row.pontos_nao_id,
    maiorParada:     row.maior_parada as { ponto: string; duracaoStr: string } | null,
  };

  const alerts    = (row.alerts    as Alert[]    | null) ?? [];
  const segments  = (row.segments  as Segment[]  | null) ?? [];
  const points    = (row.points    as Point[]    | null) ?? [];
  const comparison = row.comparison as Comparison | null;

  const criticos  = alerts.filter(a => a.nivel === "critical");
  const atencao   = alerts.filter(a => a.nivel === "attention");
  const info      = alerts.filter(a => a.nivel === "info");

  // ── Seção: Resumo ─────────────────────────────────────────────────────────
  const resumoHtml = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
      ${card("Veículo",           esc(summary.veiculo))}
      ${card("Motorista",         esc(summary.motorista))}
      ${card("Data da Viagem",    esc(summary.dataViagem))}
      ${card("Pontos",            String(summary.totalPontos))}
      ${card("Distância Total",   fmtKm(summary.totalKm))}
      ${card("Tempo em Rota",     fmtMin(summary.tempoTotalMin))}
      ${card("Vel. Média",        fmtSpeed(summary.velocidadeMedia))}
      ${card("Alertas Críticos",  String(summary.alertasCriticos), summary.alertasCriticos > 0 ? "#fef2f2" : undefined)}
    </div>
    ${summary.maiorParada ? `<p style="font-size:12px;color:#6b7280;margin-bottom:20px;">Maior parada: <strong>${esc(summary.maiorParada.ponto)}</strong> — ${esc(summary.maiorParada.duracaoStr)}</p>` : ""}
  `;

  // ── Seção: Alertas ────────────────────────────────────────────────────────
  function alertRows(list: Alert[]): string {
    return list.map(a => `
      <tr>
        <td style="padding:6px 8px;">${nivelBadge(a.nivel)}</td>
        <td style="padding:6px 8px;font-size:11px;">${tipoLabel(a.tipo)}</td>
        <td style="padding:6px 8px;font-size:11px;">${esc(a.descricao)}</td>
        <td style="padding:6px 8px;font-size:11px;color:#6b7280;">${a.trecho ? esc(a.trecho) : "—"}</td>
      </tr>
    `).join("");
  }

  const alertasHtml = alerts.length === 0
    ? `<p style="color:#6b7280;font-size:12px;">Nenhum alerta registrado.</p>`
    : `
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:7px 8px;text-align:left;font-size:11px;color:#374151;">Nível</th>
            <th style="padding:7px 8px;text-align:left;font-size:11px;color:#374151;">Tipo</th>
            <th style="padding:7px 8px;text-align:left;font-size:11px;color:#374151;">Descrição</th>
            <th style="padding:7px 8px;text-align:left;font-size:11px;color:#374151;">Trecho</th>
          </tr>
        </thead>
        <tbody>
          ${alertRows(criticos)}
          ${alertRows(atencao)}
          ${alertRows(info)}
        </tbody>
      </table>
    `;

  // ── Seção: Segmentos ──────────────────────────────────────────────────────
  const segmentosHtml = segments.length === 0
    ? `<p style="color:#6b7280;font-size:12px;">Sem segmentos.</p>`
    : `
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:6px 8px;text-align:left;color:#374151;">#</th>
            <th style="padding:6px 8px;text-align:left;color:#374151;">De</th>
            <th style="padding:6px 8px;text-align:left;color:#374151;">Para</th>
            <th style="padding:6px 8px;text-align:right;color:#374151;">Dist.</th>
            <th style="padding:6px 8px;text-align:right;color:#374151;">Tempo</th>
            <th style="padding:6px 8px;text-align:right;color:#374151;">Vel. Média</th>
            <th style="padding:6px 8px;text-align:center;color:#374151;">Alertas</th>
          </tr>
        </thead>
        <tbody>
          ${segments.map((s, i) => `
            <tr style="border-bottom:1px solid #f3f4f6;${i % 2 === 0 ? "" : "background:#fafafa"}">
              <td style="padding:6px 8px;color:#9ca3af;">${i + 1}</td>
              <td style="padding:6px 8px;">${esc(s.de)}</td>
              <td style="padding:6px 8px;">${esc(s.para)}</td>
              <td style="padding:6px 8px;text-align:right;">${fmtKm(s.distKm)}</td>
              <td style="padding:6px 8px;text-align:right;">${fmtMin(s.tempoMin)}</td>
              <td style="padding:6px 8px;text-align:right;color:${speedColor(s.velocidadeKmh)};font-weight:${s.velocidadeKmh && s.velocidadeKmh > 90 ? "700" : "400"};">${fmtSpeed(s.velocidadeKmh)}</td>
              <td style="padding:6px 8px;text-align:center;">
                ${s.alertas.length > 0
                  ? `<span style="background:#fee2e2;color:#991b1b;border-radius:10px;padding:1px 8px;font-size:10px;font-weight:700;">${s.alertas.length}</span>`
                  : `<span style="color:#9ca3af;font-size:10px;">—</span>`}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

  // ── Seção: Pontos ─────────────────────────────────────────────────────────
  const pontosHtml = `
    <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="padding:6px 8px;text-align:left;color:#374151;">#</th>
          <th style="padding:6px 8px;text-align:left;color:#374151;">Ponto</th>
          <th style="padding:6px 8px;text-align:left;color:#374151;">Entrada</th>
          <th style="padding:6px 8px;text-align:left;color:#374151;">Saída</th>
          <th style="padding:6px 8px;text-align:right;color:#374151;">Parada</th>
          <th style="padding:6px 8px;text-align:center;color:#374151;">Id.</th>
        </tr>
      </thead>
      <tbody>
        ${points.map((p, i) => `
          <tr style="border-bottom:1px solid #f3f4f6;${i % 2 === 0 ? "" : "background:#fafafa"}">
            <td style="padding:5px 8px;color:#9ca3af;">${p.seq}</td>
            <td style="padding:5px 8px;">${esc(p.ponto)}</td>
            <td style="padding:5px 8px;color:#6b7280;">${p.entrada ? esc(p.entrada) : "—"}</td>
            <td style="padding:5px 8px;color:#6b7280;">${p.saida ? esc(p.saida) : "—"}</td>
            <td style="padding:5px 8px;text-align:right;">${p.parada_s > 0 ? fmtMin(p.parada_s / 60) : "—"}</td>
            <td style="padding:5px 8px;text-align:center;">${p.matched
              ? `<span style="color:#16a34a;font-weight:700;">✓</span>`
              : `<span style="color:#dc2626;font-weight:700;">✗</span>`}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  // ── Seção: Comparação com Esquema ────────────────────────────────────────
  const comparacaoHtml = !comparison ? "" : `
    ${section("Comparação com Esquema de Rota", `
      ${comparison.naoVisitados.length > 0 ? `
        <p style="font-size:11px;color:#991b1b;margin-bottom:8px;font-weight:600;">
          Pontos não visitados (${comparison.naoVisitados.length}):
          ${comparison.naoVisitados.map(p => esc(p.nomePonto)).join(" · ")}
        </p>
      ` : `<p style="font-size:11px;color:#16a34a;margin-bottom:8px;">✓ Todos os pontos do esquema foram visitados.</p>`}

      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:6px 8px;text-align:left;color:#374151;">Ponto</th>
            <th style="padding:6px 8px;text-align:left;color:#374151;">Horário Realizado</th>
            <th style="padding:6px 8px;text-align:right;color:#374151;">Desvio</th>
          </tr>
        </thead>
        <tbody>
          ${(comparison.visitados ?? []).map((v, i) => `
            <tr style="border-bottom:1px solid #f3f4f6;${i % 2 === 0 ? "" : "background:#fafafa"}">
              <td style="padding:5px 8px;">${esc(v.nomePonto)}</td>
              <td style="padding:5px 8px;color:#6b7280;">${v.horarioRealizado ? esc(v.horarioRealizado) : "—"}</td>
              <td style="padding:5px 8px;text-align:right;${v.desvioMin != null && Math.abs(v.desvioMin) > 10 ? "color:#f59e0b;font-weight:700;" : "color:#6b7280;"}">
                ${v.desvioMin != null ? `${v.desvioMin > 0 ? "+" : ""}${v.desvioMin.toFixed(0)} min` : "—"}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `)}
  `;

  // ── HTML final ────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111827; background: #fff; }
  h1 { font-size: 18px; font-weight: 700; color: #111827; }
  h2 { font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb; }
  table { page-break-inside: auto; }
  tr    { page-break-inside: avoid; }
</style>
</head>
<body style="padding: 0;">

  <!-- Título -->
  <div style="background:#1e3a5f;color:#fff;padding:20px 24px;margin-bottom:24px;">
    <h1>Relatório de Análise de Viagem</h1>
    <p style="font-size:11px;color:#93c5fd;margin-top:4px;">
      ${esc(summary.veiculo)} &nbsp;·&nbsp; ${esc(summary.motorista)} &nbsp;·&nbsp; ${esc(summary.dataViagem)}
    </p>
  </div>

  <div style="padding: 0 24px 24px;">

    <!-- Resumo -->
    ${section("Resumo", resumoHtml)}

    <!-- Alertas -->
    ${section(`Alertas <span style="font-weight:400;font-size:12px;color:#9ca3af;">(${alerts.length} total — ${criticos.length} críticos)</span>`, alertasHtml)}

    <!-- Segmentos -->
    ${section(`Trechos <span style="font-weight:400;font-size:12px;color:#9ca3af;">(${segments.length})</span>`, segmentosHtml)}

    <!-- Comparação -->
    ${comparacaoHtml}

    <!-- Pontos detalhados -->
    ${section(`Pontos Detalhados <span style="font-weight:400;font-size:12px;color:#9ca3af;">(${points.length})</span>`, pontosHtml)}

  </div>
</body>
</html>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function card(label: string, value: string, bg?: string): string {
  return `
    <div style="background:${bg ?? "#f9fafb"};border:1px solid #e5e7eb;border-radius:6px;padding:12px 14px;">
      <div style="font-size:10px;color:#6b7280;margin-bottom:4px;">${label}</div>
      <div style="font-size:14px;font-weight:700;color:#111827;">${value}</div>
    </div>
  `;
}

function section(title: string, content: string): string {
  return `
    <div style="margin-bottom:28px;">
      <h2>${title}</h2>
      ${content}
    </div>
  `;
}
