// src/modules/disciplinary/driver-conduct.template.ts
// "Ficha de Conduta" — relatório disciplinar consolidado de um motorista.
// Reaproveita o mesmo vocabulário visual do relatório diário (daily-report.template.ts).

type ConductDriver = { code: string; name: string; base: string | null };

type ConductSituation = {
  totalOcorrencias: number;
  recentes90d: number;
  reincidencias: number;
  indice: number;
  situacao: "REGULAR" | "ATENCAO" | "CRITICO";
};

type ConductMonthly = {
  month: string; // YYYY-MM-DD
  total: number;
};

type ConductHistoryItem = {
  eventDate: string;
  typeTitle: string | null;
  typeCode: string | null;
  place: string | null;
  vehicleNumber: string | null;
  tratativa: string | null;
  analisadoPor: string | null;
  driveWebViewLink: string | null;
};

const SITUACAO_LABEL: Record<ConductSituation["situacao"], string> = {
  REGULAR: "Regular",
  ATENCAO: "Atenção",
  CRITICO: "Crítico",
};

const SITUACAO_HEX: Record<ConductSituation["situacao"], string> = {
  REGULAR: "#10b981",
  ATENCAO: "#f59e0b",
  CRITICO: "#ef4444",
};

const TRATATIVA_LABEL: Record<string, string> = {
  SUSPEICAO: "Suspensão",
  ADVERTENCIA: "Advertência",
  VALE: "Vale",
  REGISTRO: "Registro",
};

export function buildDriverConductPdfHtml(args: {
  driver: ConductDriver;
  situation: ConductSituation | null;
  monthly: ConductMonthly[];
  history: ConductHistoryItem[];
  logoDataUri?: string | null;
}): string {
  const { driver, situation, monthly, history, logoDataUri } = args;

  const situacaoHex = situation ? SITUACAO_HEX[situation.situacao] : "#9ca3af";
  const situacaoLabel = situation ? SITUACAO_LABEL[situation.situacao] : "—";

  // ── Cards de indicadores ────────────────────────────────────────────────────
  const summarySection = `
    <table class="summary-table" cellspacing="0" cellpadding="0">
      <tr>
        <td class="summary-cell">
          <div class="summary-number">${situation?.totalOcorrencias ?? "—"}</div>
          <div class="summary-label">Ocorrências (90 dias)</div>
        </td>
        <td class="summary-cell">
          <div class="summary-number">${situation?.recentes90d ?? "—"}</div>
          <div class="summary-label">Últimos 90 dias</div>
        </td>
        <td class="summary-cell">
          <div class="summary-number">${situation?.reincidencias ?? "—"}</div>
          <div class="summary-label">Reincidências</div>
        </td>
        <td class="summary-cell" style="border-color:${situacaoHex}44;">
          <div class="summary-number" style="color:${situacaoHex};">${situation ? `${situation.indice}` : "—"}</div>
          <div class="summary-label">Índice / 100</div>
        </td>
      </tr>
    </table>`;

  // ── Evolução mensal (barras) ────────────────────────────────────────────────
  const maxMonthly = Math.max(1, ...monthly.map((m) => m.total));
  const monthlyRows = monthly
    .map((m) => {
      const pct = Math.round((m.total / maxMonthly) * 100);
      return `
      <tr>
        <td class="dist-name">${esc(fmtMonthLabel(m.month))}</td>
        <td class="dist-bar-cell">
          <div class="dist-bar-bg">
            <div class="dist-bar-fill" style="width:${pct}%;"></div>
          </div>
        </td>
        <td class="dist-count">${m.total}</td>
      </tr>`;
    })
    .join("");

  const monthlySection = monthly.length > 0 ? `
    <div class="section-block">
      <div class="section-header">Evolução (últimos 3 meses)</div>
      <table class="dist-table" cellspacing="0" cellpadding="0">
        ${monthlyRows}
      </table>
    </div>` : "";

  // ── Histórico disciplinar ───────────────────────────────────────────────────
  const historyRows = history.map((h, idx) => {
    const num = String(idx + 1).padStart(2, "0");
    const title = h.typeTitle ?? h.typeCode ?? "—";
    const tratativaLabel = h.tratativa ? (TRATATIVA_LABEL[h.tratativa] ?? h.tratativa) : "Em análise";
    const tratativaCls = h.tratativa ? `tratativa-${h.tratativa.toLowerCase()}` : "";
    const rowClass = idx % 2 === 0 ? "row-even" : "row-odd";
    return `
      <tr class="${rowClass}">
        <td class="occ-num occ-td">${num}</td>
        <td class="occ-td col-nowrap" style="font-size:7.5pt;">${esc(fmtDateBr(h.eventDate))}</td>
        <td class="occ-td occ-title">${esc(title)}</td>
        <td class="occ-td" style="font-size:7.5pt; color:#374151;">${esc(h.place ?? "—")}</td>
        <td class="occ-td col-nowrap" style="font-family:monospace; font-size:7.5pt;">${esc(h.vehicleNumber ?? "—")}</td>
        <td class="occ-td col-center"><span class="tratativa-badge ${tratativaCls}">${esc(tratativaLabel)}</span></td>
        <td class="occ-td" style="font-size:7.5pt; color:#374151;">${esc(h.analisadoPor ?? "—")}</td>
      </tr>`;
  }).join("");

  const historySection = `
    <div class="section-block" style="page-break-before: always;">
      <div class="section-header">Histórico Disciplinar</div>
      <table class="occ-table" cellspacing="0" cellpadding="0">
        <thead>
          <tr>
            <th class="occ-th" style="width:22px; text-align:center;">#</th>
            <th class="occ-th" style="width:60px;">Data</th>
            <th class="occ-th" style="width:22%;">Ocorrência</th>
            <th class="occ-th">Local</th>
            <th class="occ-th" style="width:60px;">Veículo</th>
            <th class="occ-th" style="width:75px;">Medida</th>
            <th class="occ-th" style="width:90px;">Analista</th>
          </tr>
        </thead>
        <tbody>${historyRows || `<tr><td class="occ-td" colspan="7" style="text-align:center; color:#9ca3af; padding:14px;">Nenhuma ocorrência registrada nos últimos 90 dias.</td></tr>`}</tbody>
      </table>
    </div>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Ficha de Conduta — ${esc(driver.name)}</title>
  <style>
    @page {
      margin-top: 22mm;
      margin-right: 16mm;
      margin-left: 16mm;
      margin-bottom: 25mm;
    }
    body {
      font-family: "Segoe UI", "Inter", Arial, Helvetica, sans-serif;
      font-size: 11pt;
      color: #111;
      margin: 0;
    }

    /* ── Header ── */
    .report-header {
      display: flex;
      align-items: stretch;
      border: 1.5px solid #e2e8f0;
      border-radius: 5px;
      overflow: hidden;
      margin-bottom: 16px;
    }
    .report-header-logo {
      background: #fff;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 150px;
      border-right: 1.5px solid #e2e8f0;
    }
    .report-header-logo img { height: 52px; display: block; }
    .report-header-logo .logo-placeholder {
      width: 110px; height: 52px;
      background: #e2e8f0;
      border-radius: 3px;
    }
    .report-header-body {
      flex: 1;
      padding: 14px 22px;
      background: #f47920;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 3px;
    }
    .report-header-title {
      font-size: 15pt;
      font-weight: 800;
      color: #fff;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      line-height: 1.1;
    }
    .report-header-sub {
      font-size: 9pt;
      color: rgba(255,255,255,0.88);
      letter-spacing: 0.1px;
    }

    hr.sep { border: none; border-top: 2px solid #f47920; margin: 8px 0 14px; }

    .driver-info { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .driver-info-name { font-size: 13pt; font-weight: 700; color: #1e293b; }
    .driver-info-sub { font-size: 9pt; color: #6b7280; margin-top: 2px; }
    .situacao-badge {
      display: inline-block;
      border-radius: 999px;
      font-size: 9pt;
      font-weight: 700;
      padding: 4px 12px;
      color: #fff;
      background: ${situacaoHex};
    }

    .retention-note {
      font-size: 8pt;
      color: #6b7280;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 6px 10px;
      margin-bottom: 14px;
    }

    /* ── Summary table ── */
    .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    .summary-cell {
      text-align: center;
      padding: 10px 6px;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      background: #fafafa;
    }
    .summary-number { font-size: 22pt; font-weight: 700; color: #1e293b; line-height: 1; }
    .summary-label { font-size: 8.5pt; color: #6b7280; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }

    /* ── Section blocks ── */
    .section-block { margin-bottom: 18px; }
    .section-header {
      font-size: 10pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #f47920;
      border-bottom: 2px solid #f47920;
      padding-bottom: 3px;
      margin-bottom: 8px;
    }

    /* ── Distribution bars ── */
    .dist-table { width: 100%; border-collapse: collapse; }
    .dist-name { font-size: 9.5pt; padding: 3px 6px 3px 0; width: 25%; }
    .dist-bar-cell { padding: 4px 8px; }
    .dist-bar-bg { background: #f3f4f6; border-radius: 3px; height: 10px; }
    .dist-bar-fill { background: #f47920; height: 10px; border-radius: 3px; }
    .dist-count { font-size: 9.5pt; font-weight: 700; text-align: right; width: 30px; padding: 3px 0; }

    /* ── Occurrences table ── */
    .occ-table { width: 100%; border-collapse: collapse; font-size: 8pt; border: 1px solid #d1d5db; }
    .occ-th {
      background: #f47920;
      color: #fff;
      font-weight: 700;
      padding: 6px 7px;
      text-align: left;
      font-size: 7.5pt;
      white-space: nowrap;
      border-right: 1px solid rgba(255,255,255,0.25);
      letter-spacing: 0.3px;
    }
    .occ-th:last-child { border-right: none; }
    .occ-num {
      padding: 5px 6px;
      color: #9ca3af;
      font-weight: 700;
      width: 18px;
      text-align: center;
      border-right: 1px solid #e5e7eb;
      white-space: nowrap;
    }
    .occ-td {
      padding: 5px 7px;
      vertical-align: middle;
      border-right: 1px solid #e5e7eb;
      border-bottom: 1px solid #e5e7eb;
    }
    .occ-td:last-child { border-right: none; }
    .occ-title { font-weight: 700; color: #1e293b; }
    .col-nowrap { white-space: nowrap; }
    .col-center { text-align: center; }
    .occ-table tbody tr { break-inside: avoid; page-break-inside: avoid; }
    .tratativa-badge {
      display: inline-block;
      border-radius: 3px;
      font-size: 7.5pt;
      font-weight: 600;
      padding: 1px 5px;
      color: #fff;
      background: #9ca3af;
    }
    .tratativa-suspeicao   { background: #6366f1; }
    .tratativa-advertencia { background: #f59e0b; }
    .tratativa-vale        { background: #ef4444; }
    .tratativa-registro    { background: #6b7280; }
  </style>
</head>
<body>

  <div class="report-header">
    <div class="report-header-logo">
      ${logoDataUri
        ? `<img src="${logoDataUri}" alt="Logo" />`
        : `<div class="logo-placeholder"></div>`}
    </div>
    <div class="report-header-body">
      <div class="report-header-title">Ficha de Conduta do Motorista</div>
      <div class="report-header-sub">Relatório disciplinar consolidado</div>
    </div>
  </div>

  <hr class="sep" />

  <div class="driver-info">
    <div>
      <div class="driver-info-name">${esc(driver.name)}</div>
      <div class="driver-info-sub">Código ${esc(driver.code)} &nbsp;·&nbsp; Base: ${esc(driver.base ?? "—")}</div>
    </div>
    <span class="situacao-badge">${esc(situacaoLabel)}</span>
  </div>

  <div class="retention-note">
    Este relatório reflete apenas os últimos 90 dias — ocorrências mais antigas são removidas automaticamente do sistema (limpeza mensal de dados).
  </div>

  ${summarySection}
  ${monthlySection}
  ${historySection}

</body>
</html>`;
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fmtDateBr(iso: string): string {
  const parts = (iso ?? "").split("-");
  if (parts.length !== 3) return iso ?? "—";
  const [y, m, d] = parts;
  return `${d?.padStart(2, "0")}/${m?.padStart(2, "0")}/${y}`;
}

const MESES_ABREV = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function fmtMonthLabel(monthISO: string): string {
  const [year, month] = (monthISO ?? "").split("-");
  const idx = Number(month) - 1;
  return `${MESES_ABREV[idx] ?? month}/${year?.slice(2) ?? ""}`;
}
