type DailyOccurrence = {
  id: string;
  typeCode: string | null;
  typeTitle: string | null;
  reportTitle: string | null;
  eventDate: string;
  tripDate: string;
  startTime: string;
  endTime: string;
  vehicleNumber: string;
  baseCode: string | null;
  lineLabel: string | null;
  place: string | null;
  speedKmh: number | null;
  drivers: Array<{ position: number; registry?: string | null; name?: string | null; baseCode?: string | null }>;
  evidenceCount: number;
  tratativa: string | null;
  analisadoPor: string | null;
  justificativaRegistro: string | null;
};

type DailyStats = {
  totalOcc: number;
  totalDrivers: number;
  totalVehicles: number;
  totalAdvertencias: number;
  totalSuspeicoes: number;
  byType: Array<{ name: string; count: number }>;
  byBase: Array<{ base: string; count: number }>;
  byAnalyst: Array<{ name: string; count: number }>;
  driverRanking: Array<{ name: string; count: number; base: string }>;
};

function computeStats(occurrences: DailyOccurrence[]): DailyStats {
  const driversSet = new Set<string>();
  const vehiclesSet = new Set<string>();
  const basesMap = new Map<string, number>();
  const typesMap = new Map<string, { name: string; count: number }>();
  const driverCountMap = new Map<string, { name: string; count: number; base: string }>();
  const analystMap = new Map<string, number>();
  let totalAdvertencias = 0;
  let totalSuspeicoes = 0;

  for (const o of occurrences) {
    vehiclesSet.add(o.vehicleNumber);
    for (const d of o.drivers) {
      if (d.registry) driversSet.add(d.registry);
      else if (d.name) driversSet.add(d.name);
    }
    const base = o.baseCode || "—";
    basesMap.set(base, (basesMap.get(base) ?? 0) + 1);

    const occTitle = occTitle_(o);
    const prev = typesMap.get(o.typeCode ?? "") ?? { name: occTitle, count: 0 };
    typesMap.set(o.typeCode ?? "", { ...prev, count: prev.count + 1 });

    const d1 = o.drivers.find((d) => d.position === 1);
    if (d1) {
      const key = d1.registry ?? d1.name ?? "?";
      const prev2 = driverCountMap.get(key) ?? { name: d1.name ?? key, count: 0, base: d1.baseCode ?? o.baseCode ?? "—" };
      driverCountMap.set(key, { ...prev2, count: prev2.count + 1 });
    }

    const analyst = (o.analisadoPor ?? "").trim();
    if (analyst) analystMap.set(analyst, (analystMap.get(analyst) ?? 0) + 1);

    if (o.tratativa === "ADVERTENCIA") totalAdvertencias++;
    if (o.tratativa === "SUSPEICAO") totalSuspeicoes++;
  }

  const byType = [...typesMap.values()].sort((a, b) => b.count - a.count);
  const byAnalyst = [...analystMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const byBase = [...basesMap.entries()]
    .map(([base, count]) => ({ base, count }))
    .sort((a, b) => b.count - a.count);
  const driverRanking = [...driverCountMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalOcc: occurrences.length,
    totalDrivers: driversSet.size,
    totalVehicles: vehiclesSet.size,
    totalAdvertencias,
    totalSuspeicoes,
    byType,
    byBase,
    byAnalyst,
    driverRanking,
  };
}

function scoreStatus(score: number): { label: string; hex: string } {
  if (score >= 8) return { label: "Operação dentro do padrão", hex: "#10b981" };
  if (score >= 6) return { label: "Atenção necessária", hex: "#f59e0b" };
  if (score >= 4) return { label: "Situação preocupante", hex: "#f97316" };
  return { label: "Dia crítico", hex: "#ef4444" };
}

function occTitle_(o: DailyOccurrence): string {
  return o.typeCode === "GENERICO" && o.reportTitle ? o.reportTitle : (o.typeTitle ?? o.typeCode ?? "—");
}

// ── Public export ─────────────────────────────────────────────────────────────

export function buildDailyReportPdfHtml(args: {
  occurrences: DailyOccurrence[];
  date: string;
  logoDataUri?: string | null;
}): string {
  const { occurrences, date, logoDataUri } = args;

  const stats = computeStats(occurrences);
  const dateLabel = fmtDateBr(date);

  const sorted = [...occurrences].sort((a, b) =>
    a.startTime.localeCompare(b.startTime) || a.eventDate.localeCompare(b.eventDate),
  );

  // ── Seção 1: Resumo ─────────────────────────────────────────────────────────
  const analystCells = stats.byAnalyst.map((a) => `
        <td class="summary-cell analyst-cell">
          <div class="summary-number">${a.count}</div>
          <div class="summary-label">${esc(a.name)}</div>
        </td>`).join("");

  const summarySection = `
    <table class="summary-table" cellspacing="0" cellpadding="0">
      <tr>
        <td class="summary-cell">
          <div class="summary-number">${stats.totalOcc}</div>
          <div class="summary-label">Ocorrências</div>
        </td>
        <td class="summary-cell">
          <div class="summary-number">${stats.totalVehicles}</div>
          <div class="summary-label">Veículos</div>
        </td>
        <td class="summary-cell">
          <div class="summary-number">${stats.totalDrivers}</div>
          <div class="summary-label">Motoristas</div>
        </td>
        <td class="summary-cell adv-cell">
          <div class="summary-number">${stats.totalAdvertencias}</div>
          <div class="summary-label">Advertências</div>
        </td>
        <td class="summary-cell susp-cell">
          <div class="summary-number">${stats.totalSuspeicoes}</div>
          <div class="summary-label">Suspensões</div>
        </td>${analystCells}
      </tr>
    </table>`;

  // ── Seção 2: Distribuição por tipo ──────────────────────────────────────────
  const maxTypeCount = stats.byType[0]?.count ?? 1;
  const typeRows = stats.byType.map((t) => {
    const pct = Math.round((t.count / maxTypeCount) * 100);
    return `
      <tr>
        <td class="dist-name">${esc(t.name)}</td>
        <td class="dist-bar-cell">
          <div class="dist-bar-bg">
            <div class="dist-bar-fill" style="width:${pct}%;"></div>
          </div>
        </td>
        <td class="dist-count">${t.count}</td>
      </tr>`;
  }).join("");

  const typeSection = stats.byType.length > 0 ? `
    <div class="section-block">
      <div class="section-header">Distribuição por Tipo</div>
      <table class="dist-table" cellspacing="0" cellpadding="0">
        ${typeRows}
      </table>
    </div>` : "";

  // ── Seção 3: Ranking de bases ───────────────────────────────────────────────
  const baseRows = stats.byBase.slice(0, 8).map((b, i) => `
    <tr class="${i % 2 === 0 ? "row-even" : "row-odd"}">
      <td class="rank-pos">${i + 1}º</td>
      <td class="rank-name">${esc(b.base)}</td>
      <td class="rank-count">${b.count}</td>
    </tr>`).join("");

  const baseSection = stats.byBase.length > 0 ? `
    <div class="section-block half">
      <div class="section-header">Ocorrências por Base</div>
      <table class="rank-table" cellspacing="0" cellpadding="0">
        <thead><tr><th class="rank-th">#</th><th class="rank-th">Base</th><th class="rank-th">Qtd.</th></tr></thead>
        <tbody>${baseRows}</tbody>
      </table>
    </div>` : "";

  // ── Seção 4: Ranking de motoristas ──────────────────────────────────────────
  const driverRows = stats.driverRanking.map((d, i) => `
    <tr class="${i % 2 === 0 ? "row-even" : "row-odd"}">
      <td class="rank-pos">${i + 1}º</td>
      <td class="rank-name">${esc(d.name)}</td>
      <td class="rank-base">${esc(d.base)}</td>
      <td class="rank-count">${d.count}</td>
    </tr>`).join("");

  const driverSection = stats.driverRanking.length > 0 ? `
    <div class="section-block half">
      <div class="section-header">Top Motoristas (Ocorrências)</div>
      <table class="rank-table" cellspacing="0" cellpadding="0">
        <thead><tr><th class="rank-th">#</th><th class="rank-th">Motorista</th><th class="rank-th">Base</th><th class="rank-th">Qtd.</th></tr></thead>
        <tbody>${driverRows}</tbody>
      </table>
    </div>` : "";

  // ── Seção 5: Lista de ocorrências ───────────────────────────────────────────
  const TRATATIVA_LABEL: Record<string, string> = {
    SUSPEICAO: "Suspensão",
    ADVERTENCIA: "Advertência",
    VALE: "Vale",
    REGISTRO: "Registro",
  };

  const occRows = sorted.map((o, idx) => {
    const num = String(idx + 1).padStart(2, "0");
    const title = occTitle_(o);
    const d1 = o.drivers.find((d) => d.position === 1);
    const driverStr = d1 ? [d1.registry, d1.name].filter(Boolean).join(" — ") : "—";
    const line = o.lineLabel ?? "—";
    const tratativaLabel = o.tratativa ? (TRATATIVA_LABEL[o.tratativa] ?? o.tratativa) : "—";
    const tratativaCls = o.tratativa ? `tratativa-${o.tratativa.toLowerCase()}` : "";
    const hasJustificativa = o.tratativa === "REGISTRO" && o.justificativaRegistro?.trim();
    const rowClass = idx % 2 === 0 ? "row-even" : "row-odd";
    return `
      <tr class="${rowClass}">
        <td class="occ-num occ-td">${num}</td>
        <td class="occ-td occ-title">${esc(title)}</td>
        <td class="occ-td col-nowrap" style="font-family:monospace; font-size:7.5pt;">${esc(o.vehicleNumber)}</td>
        <td class="occ-td" style="font-size:7.5pt; color:#374151;">${esc(line)}</td>
        <td class="occ-td col-nowrap" style="font-weight:600; color:#374151;">${esc(o.baseCode ?? "—")}</td>
        <td class="occ-td" style="font-size:7.5pt;">${esc(driverStr)}</td>
        <td class="occ-td col-center"><span class="tratativa-badge ${tratativaCls}">${esc(tratativaLabel)}</span></td>
        <td class="occ-td" style="font-size:7.5pt; color:#374151;">${esc(o.analisadoPor ?? "—")}</td>
      </tr>
      ${hasJustificativa ? `
      <tr class="${rowClass}">
        <td class="occ-td" style="border-top:none;"></td>
        <td class="occ-td" colspan="7" style="border-top:none; padding-top:0; padding-bottom:5px;">
          <span style="font-size:7pt; color:#6b7280; font-style:italic;">Justificativa: </span>
          <span style="font-size:7pt; color:#374151;">${esc(o.justificativaRegistro!)}</span>
        </td>
      </tr>` : ""}`;
  }).join("");

  const occListSection = sorted.length > 0 ? `
    <div class="section-block" style="page-break-before: always;">
      <div class="section-header">Listagem Completa de Ocorrências</div>
      <table class="occ-table" cellspacing="0" cellpadding="0">
        <thead>
          <tr>
            <th class="occ-th" style="width:22px; text-align:center;">#</th>
            <th class="occ-th" style="width:22%;">Ocorrência</th>
            <th class="occ-th" style="width:52px;">Veículo</th>
            <th class="occ-th" style="width:18%;">Linha</th>
            <th class="occ-th" style="width:70px;">Base</th>
            <th class="occ-th">Motorista</th>
            <th class="occ-th" style="width:70px;">Tratativa</th>
            <th class="occ-th" style="width:80px;">Analista</th>
          </tr>
        </thead>
        <tbody>${occRows}</tbody>
      </table>
    </div>` : "";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Relatório Diário — ${dateLabel}</title>
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
      font-family: "Segoe UI", "Inter", Arial, sans-serif;
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
    hr.sep-thin { border: none; border-top: 1px solid #e5e7eb; margin: 10px 0; }

    /* ── Summary table ── */
    .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    .summary-cell {
      text-align: center;
      padding: 10px 6px;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      background: #fafafa;
    }
    .adv-cell  { background: #fffbeb; border-color: #fcd34d; }
    .susp-cell { background: #f5f3ff; border-color: #c4b5fd; }
    .analyst-cell { background: #ecfeff; border-color: #67e8f9; }
    .adv-cell  .summary-number { color: #d97706; }
    .susp-cell .summary-number { color: #7c3aed; }
    .analyst-cell .summary-number { color: #0891b2; }
    .summary-number { font-size: 22pt; font-weight: 700; color: #1e293b; line-height: 1; }
    .summary-label { font-size: 8.5pt; color: #6b7280; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }

    /* ── Section blocks ── */
    .section-block { margin-bottom: 18px; }
    .section-block.half { display: inline-block; width: 48%; vertical-align: top; margin-right: 2%; }
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
    .dist-name { font-size: 9.5pt; padding: 3px 6px 3px 0; width: 35%; }
    .dist-bar-cell { padding: 4px 8px; }
    .dist-bar-bg { background: #f3f4f6; border-radius: 3px; height: 10px; }
    .dist-bar-fill { background: #f47920; height: 10px; border-radius: 3px; }
    .dist-count { font-size: 9.5pt; font-weight: 700; text-align: right; width: 30px; padding: 3px 0; }

    /* ── Ranking tables ── */
    .rank-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    .rank-th { background: #f47920; color: #fff; font-weight: 600; padding: 5px 6px; text-align: left; font-size: 9pt; }
    .rank-pos { padding: 4px 6px; color: #6b7280; font-weight: 600; width: 24px; }
    .rank-name { padding: 4px 6px; }
    .rank-base { padding: 4px 6px; color: #6b7280; font-size: 9pt; }
    .rank-count { padding: 4px 6px; font-weight: 700; text-align: right; width: 30px; color: #f47920; }
    .row-even td { background: #fff; color: #111; }
    .row-odd  td { background: #f9fafb; color: #111; }

    /* ── Occurrences list ── */
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
    .ev-badge {
      display: inline-block;
      background: #f47920;
      color: #fff;
      border-radius: 3px;
      font-size: 7pt;
      padding: 1px 4px;
      margin-left: 4px;
      vertical-align: middle;
    }
    .tratativa-badge {
      display: inline-block;
      border-radius: 3px;
      font-size: 7.5pt;
      font-weight: 600;
      padding: 1px 5px;
      color: #fff;
      background: #9ca3af;
    }
    .tratativa-suspeicao  { background: #6366f1; }
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
      <div class="report-header-title">Relatório Diário Consolidado</div>
      <div class="report-header-sub">${dateLabel} &nbsp;·&nbsp; ${stats.totalOcc} ocorrência${stats.totalOcc !== 1 ? "s" : ""} registrada${stats.totalOcc !== 1 ? "s" : ""}</div>
    </div>
  </div>

  <hr class="sep" />

  ${summarySection}

  <div style="display:flex; gap:2%;">
    ${typeSection}
  </div>

  <div style="display:flex; gap:3%; margin-top:4px;">
    ${baseSection}
    ${driverSection}
  </div>

  ${occListSection}

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

function fmtTime(t: string): string {
  const [h, m] = (t ?? "").split(":");
  if (!h || !m) return t ?? "—";
  return `${h}h${m}`;
}
