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
};

type DailyStats = {
  score: number;
  scoreLabel: string;
  scoreHex: string;
  totalOcc: number;
  totalDrivers: number;
  totalVehicles: number;
  totalEvidences: number;
  byType: Array<{ name: string; count: number }>;
  byBase: Array<{ base: string; count: number }>;
  driverRanking: Array<{ name: string; count: number; base: string }>;
};

function computeStats(occurrences: DailyOccurrence[]): DailyStats {
  let score = 10;
  for (const o of occurrences) {
    score -= o.typeCode === "EXCESSO_VELOCIDADE" ? 0.8 : 0.4;
  }
  score = Math.max(0, Math.round(score * 10) / 10);

  const { label: scoreLabel, hex: scoreHex } = scoreStatus(score);

  const driversSet = new Set<string>();
  const vehiclesSet = new Set<string>();
  const basesMap = new Map<string, number>();
  const typesMap = new Map<string, { name: string; count: number }>();
  const driverCountMap = new Map<string, { name: string; count: number; base: string }>();

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
  }

  const byType = [...typesMap.values()].sort((a, b) => b.count - a.count);
  const byBase = [...basesMap.entries()]
    .map(([base, count]) => ({ base, count }))
    .sort((a, b) => b.count - a.count);
  const driverRanking = [...driverCountMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    score,
    scoreLabel,
    scoreHex,
    totalOcc: occurrences.length,
    totalDrivers: driversSet.size,
    totalVehicles: vehiclesSet.size,
    totalEvidences: occurrences.reduce((s, o) => s + (o.evidenceCount ?? 0), 0),
    byType,
    byBase,
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

  const logoHtml = logoDataUri
    ? `<img class="logo" src="${logoDataUri}" alt="Logo" />`
    : `<div class="logo-spacer"></div>`;

  const scoreBar = `
    <div style="display:inline-flex; align-items:center; gap:10px;">
      <span style="font-size:26pt; font-weight:700; color:${stats.scoreHex};">${stats.score}</span>
      <span style="font-size:9pt; color:${stats.scoreHex}; font-weight:600;">${esc(stats.scoreLabel)}</span>
    </div>`;

  // ── Seção 1: Resumo ─────────────────────────────────────────────────────────
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
        <td class="summary-cell">
          <div class="summary-number">${stats.totalEvidences}</div>
          <div class="summary-label">Evidências</div>
        </td>
        <td class="summary-cell score-cell">
          <div class="summary-label" style="margin-bottom:4px;">Score do dia</div>
          ${scoreBar}
        </td>
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
  const occRows = sorted.map((o, idx) => {
    const num = String(idx + 1).padStart(2, "0");
    const title = occTitle_(o);
    const d1 = o.drivers.find((d) => d.position === 1);
    const driverStr = d1 ? [d1.registry, d1.name].filter(Boolean).join(" — ") : "—";
    const startFmt = fmtTime(o.startTime);
    const endFmt = fmtTime(o.endTime);
    const timeStr = startFmt === endFmt ? startFmt : `${startFmt} à ${endFmt}`;
    const line = o.lineLabel ?? "—";
    const place = o.place ?? "—";
    const speedCell = o.typeCode === "EXCESSO_VELOCIDADE"
      ? `<td class="occ-td">${o.speedKmh ? `${o.speedKmh} km/h` : "—"}</td>`
      : `<td class="occ-td">${esc(place)}</td>`;
    const evBadge = o.evidenceCount > 0
      ? `<span class="ev-badge">${o.evidenceCount} ev.</span>`
      : "";
    return `
      <tr class="${idx % 2 === 0 ? "row-even" : "row-odd"}">
        <td class="occ-num">${num}</td>
        <td class="occ-td occ-title">${esc(title)} ${evBadge}</td>
        <td class="occ-td">${esc(fmtDateBr(o.eventDate))}</td>
        <td class="occ-td">${esc(timeStr)}</td>
        <td class="occ-td">${esc(o.vehicleNumber)}</td>
        <td class="occ-td">${esc(line)}</td>
        ${speedCell}
        <td class="occ-td">${esc(o.baseCode ?? "—")}</td>
        <td class="occ-td">${esc(driverStr)}</td>
      </tr>`;
  }).join("");

  const occListSection = sorted.length > 0 ? `
    <div class="section-block" style="page-break-before: always;">
      <div class="section-header">Listagem Completa de Ocorrências</div>
      <table class="occ-table" cellspacing="0" cellpadding="0">
        <thead>
          <tr>
            <th class="occ-th">#</th>
            <th class="occ-th">Ocorrência</th>
            <th class="occ-th">Data</th>
            <th class="occ-th">Horário</th>
            <th class="occ-th">Veículo</th>
            <th class="occ-th">Linha</th>
            <th class="occ-th">Local / Vel.</th>
            <th class="occ-th">Base</th>
            <th class="occ-th">Motorista</th>
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
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }
    .logo { height: 68px; display: block; }
    .logo-spacer { width: 160px; height: 68px; }
    .header-spacer { width: 160px; }
    .header-title {
      flex: 1;
      text-align: center;
      font-family: "Georgia", "Times New Roman", serif;
      font-size: 17pt;
      font-weight: 700;
      letter-spacing: 1.2px;
      line-height: 1.2;
    }
    .header-sub {
      text-align: center;
      font-size: 10pt;
      color: #555;
      margin-bottom: 12px;
      margin-top: -8px;
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
    .score-cell { background: #fff8f3; border-color: #f47920; }
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
    .row-even { background: #fff; }
    .row-odd { background: #f9fafb; }

    /* ── Occurrences list ── */
    .occ-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
    .occ-th {
      background: #f47920;
      color: #fff;
      font-weight: 600;
      padding: 5px 5px;
      text-align: left;
      font-size: 8pt;
      white-space: nowrap;
    }
    .occ-num { padding: 4px 5px; color: #9ca3af; font-weight: 600; width: 22px; }
    .occ-td { padding: 4px 5px; vertical-align: top; }
    .occ-title { font-weight: 600; }
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
  </style>
</head>
<body>

  <div class="header">
    ${logoHtml}
    <div class="header-title">
      <div>RELATÓRIO DIÁRIO</div>
      <div>CONSOLIDADO</div>
    </div>
    <div class="header-spacer"></div>
  </div>
  <div class="header-sub">${dateLabel} &nbsp;·&nbsp; ${stats.totalOcc} ocorrência${stats.totalOcc !== 1 ? "s" : ""} registrada${stats.totalOcc !== 1 ? "s" : ""}</div>

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
