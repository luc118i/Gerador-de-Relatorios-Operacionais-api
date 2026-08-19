// relatorio-geral-tp.template.ts
// PDF "Relatório Geral — Tempo de Permanência" (BI PC's Não Autorizados /
// tempo_permanencia.html, botão no cabeçalho do Dashboard) — consolida
// TODO o período filtrado no dashboard num único documento: KPIs, linha
// do tempo por dia, distribuição por região, top pontos de parada,
// rankings de linhas/motoristas e motivos de análise. Mesmo padrão dos
// outros relatórios deste módulo: os dados já vêm prontos do chamador
// (Apps Script agrega a aba HISTORICO_EXCESSO/TEMPO_PERMANENCIA_STATUS),
// aqui só é montado o HTML/PDF — ver resumo-analise.template.ts (mesma
// ideia, escopo menor).

const CORES_PAL = [
  "#f47920", "#3b82c4", "#22c97a", "#f0c040", "#e05050",
  "#8b5cf6", "#38bdf8", "#ec4899", "#a3e635", "#fb923c",
];

export type RelatorioGeralTPItemContagem = { chave: string; count: number };

export type RelatorioGeralTPBody = {
  periodoIni: string; // "YYYY-MM-DD"
  periodoFim: string; // "YYYY-MM-DD"
  geradoPor?: string | null | undefined;
  kpis: {
    totalRelatorios: number;
    totalVeiculos: number;
    pontoTop: { nome: string; count: number } | null;
    motoristaTop: { nome: string; count: number } | null;
  };
  porDia: RelatorioGeralTPItemContagem[]; // chave = "YYYY-MM-DD", ordenado
  porRegiao: RelatorioGeralTPItemContagem[]; // já ordenado desc
  topPontos: RelatorioGeralTPItemContagem[]; // top N, já ordenado desc
  rankLinhas: RelatorioGeralTPItemContagem[]; // top N, já ordenado desc
  rankMotoristas: RelatorioGeralTPItemContagem[]; // top N, já ordenado desc
  motivosAnalise: Array<{ motivo: string; label: string; cor: string; count: number }>;
  logoDataUri?: string | null | undefined;
};

function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fmtDataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function fmtDataCurta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}` : iso;
}

// ── Gráfico de linha (SVG puro — sem lib de canvas no PDF) ────────────────
function buildLineChartSvg(dias: RelatorioGeralTPItemContagem[]): string {
  const W = 700, H = 220, padL = 34, padR = 12, padT = 14, padB = 34;
  const innerW = W - padL - padR, innerH = H - padT - padB;

  const max = Math.max(1, ...dias.map((d) => d.count));
  const n = dias.length;
  const stepX = n > 1 ? innerW / (n - 1) : 0;
  const x = (i: number) => padL + i * stepX;
  const y = (v: number) => padT + innerH - (v / max) * innerH;

  const pontos = dias.map((d, i) => `${x(i).toFixed(1)},${y(d.count).toFixed(1)}`).join(" ");
  const areaPontos = `${padL},${padT + innerH} ${pontos} ${x(n - 1).toFixed(1)},${padT + innerH}`;

  // Grade horizontal (4 linhas) + rótulos do eixo Y
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const gy = padT + innerH - f * innerH;
    const val = Math.round(max * f);
    return `
      <line x1="${padL}" y1="${gy.toFixed(1)}" x2="${W - padR}" y2="${gy.toFixed(1)}" stroke="#e5e7eb" stroke-width="1" />
      <text x="${padL - 6}" y="${(gy + 3).toFixed(1)}" font-size="8" fill="#9ca3af" text-anchor="end">${val}</text>
    `;
  }).join("");

  // Rótulos do eixo X — evita poluir quando há muitos dias (mostra no
  // máximo ~10, distribuídos igualmente ao longo do período).
  const maxLabels = 10;
  const passo = n > maxLabels ? Math.ceil(n / maxLabels) : 1;
  const labels = dias.map((d, i) => {
    if (i % passo !== 0 && i !== n - 1) return "";
    return `<text x="${x(i).toFixed(1)}" y="${H - 6}" font-size="8" fill="#9ca3af" text-anchor="middle">${fmtDataCurta(d.chave)}</text>`;
  }).join("");

  const pontosCirculos = n <= 40
    ? dias.map((d, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(d.count).toFixed(1)}" r="2.4" fill="#f47920" />`).join("")
    : "";

  return `
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" xmlns="http://www.w3.org/2000/svg">
      ${gridLines}
      <polygon points="${areaPontos}" fill="rgba(244,121,32,0.10)" />
      <polyline points="${pontos}" fill="none" stroke="#f47920" stroke-width="2" />
      ${pontosCirculos}
      ${labels}
    </svg>
  `;
}

// ── Lista com barra horizontal (mesmo padrão do dist-table já usado no
//    "Resumo de Análise") — reaproveitada pra região/top pontos/rankings.
function buildBarList(itens: RelatorioGeralTPItemContagem[], opts?: { cores?: string[] }): string {
  if (!itens.length) return `<p style="font-size:9.5pt;color:#6b7280;">Sem dados no período.</p>`;
  const max = Math.max(1, ...itens.map((it) => it.count));
  const cores = opts?.cores;
  const rows = itens.map((it, i) => {
    const pct = Math.round((it.count / max) * 100);
    const cor = cores ? cores[i % cores.length] : CORES_PAL[i % CORES_PAL.length];
    return `
      <tr>
        <td class="dist-name">${esc(it.chave)}</td>
        <td class="dist-bar-cell">
          <div class="dist-bar-bg"><div class="dist-bar-fill" style="width:${pct}%;background:${cor};"></div></div>
        </td>
        <td class="dist-count">${it.count}</td>
      </tr>`;
  }).join("");
  return `<table class="dist-table">${rows}</table>`;
}

function buildRankList(itens: RelatorioGeralTPItemContagem[]): string {
  if (!itens.length) return `<p style="font-size:9.5pt;color:#6b7280;">Sem dados no período.</p>`;
  const rows = itens.map((it, i) => `
    <tr class="${i % 2 === 0 ? "row-even" : "row-odd"}">
      <td class="occ-num occ-td" style="width:22px;">${i + 1}</td>
      <td class="occ-td">${esc(it.chave)}</td>
      <td class="occ-td col-nowrap col-center" style="width:60px;font-weight:700;">${it.count}</td>
    </tr>`).join("");
  return `
    <table class="occ-table" cellspacing="0" cellpadding="0">
      <tbody>${rows}</tbody>
    </table>
  `;
}

export function buildRelatorioGeralTpPdfHtml(args: RelatorioGeralTPBody): string {
  const { periodoIni, periodoFim, geradoPor, kpis, porDia, porRegiao, topPontos, rankLinhas, rankMotoristas, motivosAnalise, logoDataUri } = args;

  const periodoLabel = `${fmtDataBR(periodoIni)} a ${fmtDataBR(periodoFim)}`;

  const motivosHtml = motivosAnalise.length ? `
    <div class="section-header">Motivos de análise (descartes)</div>
    ${buildBarList(
      motivosAnalise.map((m) => ({ chave: m.label, count: m.count })),
      { cores: motivosAnalise.map((m) => m.cor) },
    )}
  ` : "";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Relatório Geral — Tempo de Permanência</title>
  <style>
    @page { margin-top: 22mm; margin-right: 16mm; margin-left: 16mm; margin-bottom: 25mm; }
    body { font-family: "Segoe UI", "Inter", Arial, Helvetica, sans-serif; font-size: 10.5pt; color: #111; margin: 0; }

    .report-header { display: flex; align-items: stretch; border: 1.5px solid #e2e8f0; border-radius: 5px; overflow: hidden; margin-bottom: 16px; }
    .report-header-logo { background: #fff; padding: 14px 20px; display: flex; align-items: center; justify-content: center; min-width: 150px; border-right: 1.5px solid #e2e8f0; }
    .report-header-logo img { height: 52px; display: block; }
    .report-header-body { flex: 1; padding: 14px 22px; background: #f47920; display: flex; flex-direction: column; justify-content: center; gap: 3px; }
    .report-header-title { font-size: 15pt; font-weight: 800; color: #fff; letter-spacing: 0.5px; text-transform: uppercase; line-height: 1.1; }
    .report-header-sub { font-size: 9pt; color: rgba(255,255,255,0.88); letter-spacing: 0.1px; }

    hr.sep { border: none; border-top: 2px solid #f47920; margin: 8px 0 14px; }

    .summary-table { width: 100%; border-collapse: separate; border-spacing: 6px 0; margin: 0 0 20px -6px; }
    .summary-cell { text-align: center; padding: 10px 6px; border: 1px solid #e5e7eb; border-radius: 4px; background: #fafafa; }
    .summary-number { font-size: 18pt; font-weight: 700; color: #1e293b; line-height: 1.1; }
    .summary-label { font-size: 8pt; color: #6b7280; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.4px; }
    .summary-sub { font-size: 7.5pt; color: #9ca3af; margin-top: 2px; }

    .section-header { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #f47920; border-bottom: 2px solid #f47920; padding-bottom: 3px; margin: 22px 0 8px; }
    .section-header:first-of-type { margin-top: 0; }

    .cols-2 { display: flex; gap: 20px; }
    .cols-2 > div { flex: 1; min-width: 0; }

    .dist-table { width: 100%; border-collapse: collapse; }
    .dist-name { font-size: 9pt; padding: 3px 6px 3px 0; width: 42%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dist-bar-cell { padding: 4px 8px; }
    .dist-bar-bg { background: #f3f4f6; border-radius: 3px; height: 10px; }
    .dist-bar-fill { height: 10px; border-radius: 3px; }
    .dist-count { font-size: 9pt; font-weight: 700; text-align: right; width: 30px; padding: 3px 0; }

    .occ-table { width: 100%; border-collapse: collapse; font-size: 9pt; border: 1px solid #d1d5db; }
    .occ-num { padding: 5px 6px; color: #9ca3af; font-weight: 700; text-align: center; border-right: 1px solid #e5e7eb; }
    .occ-td { padding: 5px 7px; vertical-align: middle; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
    .occ-td:last-child { border-right: none; }
    .col-nowrap { white-space: nowrap; }
    .col-center { text-align: center; }
    .occ-table tbody tr { break-inside: avoid; page-break-inside: avoid; }
    .row-even td { background: #fff; color: #111; }
    .row-odd  td { background: #f9fafb; color: #111; }

    .chart-box { border: 1px solid #e5e7eb; border-radius: 5px; padding: 10px 12px 4px; }
  </style>
</head>
<body>

  <div class="report-header">
    <div class="report-header-logo">
      ${logoDataUri ? `<img src="${logoDataUri}" alt="Logo" />` : `<div style="width:110px;height:52px;background:#e2e8f0;border-radius:3px;"></div>`}
    </div>
    <div class="report-header-body">
      <div class="report-header-title">Relatório Geral — Tempo de Permanência</div>
      <div class="report-header-sub">${esc(periodoLabel)}${geradoPor ? ` &nbsp;·&nbsp; Gerado por ${esc(geradoPor)}` : ""}</div>
    </div>
  </div>

  <hr class="sep" />

  <table class="summary-table"><tr>
    <td class="summary-cell">
      <div class="summary-number">${kpis.totalRelatorios}</div>
      <div class="summary-label">Relatórios gerados</div>
      <div class="summary-sub">no período</div>
    </td>
    <td class="summary-cell">
      <div class="summary-number">${kpis.totalVeiculos}</div>
      <div class="summary-label">Veículos envolvidos</div>
      <div class="summary-sub">prefixos únicos</div>
    </td>
    <td class="summary-cell">
      <div class="summary-number" style="font-size:11pt;">${kpis.pontoTop ? esc(kpis.pontoTop.nome) : "—"}</div>
      <div class="summary-label">Ponto mais recorrente</div>
      <div class="summary-sub">${kpis.pontoTop ? `${kpis.pontoTop.count} ocorrência${kpis.pontoTop.count !== 1 ? "s" : ""}` : "—"}</div>
    </td>
    <td class="summary-cell">
      <div class="summary-number" style="font-size:11pt;">${kpis.motoristaTop ? esc(kpis.motoristaTop.nome) : "—"}</div>
      <div class="summary-label">Motorista mais recorrente</div>
      <div class="summary-sub">${kpis.motoristaTop ? `${kpis.motoristaTop.count} ocorrência${kpis.motoristaTop.count !== 1 ? "s" : ""}` : "—"}</div>
    </td>
  </tr></table>

  <div class="section-header">Excedências por dia</div>
  <div class="chart-box">${buildLineChartSvg(porDia)}</div>

  <div class="section-header">Por região</div>
  ${buildBarList(porRegiao)}

  <div class="section-header" style="page-break-before: always;">Top pontos de parada</div>
  ${buildBarList(topPontos)}

  <div class="section-header">Rankings</div>
  <div class="cols-2">
    <div>
      <p style="font-size:8.5pt;color:#6b7280;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;">Linhas mais recorrentes</p>
      ${buildRankList(rankLinhas)}
    </div>
    <div>
      <p style="font-size:8.5pt;color:#6b7280;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;">Motoristas mais recorrentes</p>
      ${buildRankList(rankMotoristas)}
    </div>
  </div>

  ${motivosHtml}

</body>
</html>`;
}
