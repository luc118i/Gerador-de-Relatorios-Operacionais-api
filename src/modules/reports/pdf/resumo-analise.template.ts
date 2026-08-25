// resumo-analise.template.ts
// PDF "Resumo de Análise — Tempo de Permanência" (BI PC's Não
// Autorizados / tempo_permanencia.html) — documento de registro/
// consulta com tudo que já foi ANALISADO numa região (relatório
// gerado = culpa do motorista, ou descartado por justificativa). Não
// tem ligação com ocorrências no banco deste projeto: os dados vêm
// prontos do chamador (Apps Script), só o HTML/PDF é montado aqui,
// reaproveitando o mesmo renderer com cabeçalho/rodapé (page.pdf
// footerTemplate, com numeração de página) que os outros relatórios já
// usam — ver pdf.puppeteer.ts.

export type ResumoAnaliseItem = {
  veiculo: string;
  ponto: string;
  cidade?: string | null | undefined;
  uf?: string | null | undefined;
  entrada: string; // "HH:MM"
  saida: string; // "HH:MM"
  excedenteMin?: number | null | undefined;
  motivo?: string | null | undefined;
  motivoLabel: string;
  motivoCor?: string | null | undefined;
  detalhe?: string | null | undefined;
};

// Ponto de apoio: "permitido" vem da parada prevista no esquema
// operacional da linha (não de uma tabela fixa por cidade, como
// rodoviária) — pode ser null quando o item foi descartado por
// justificativa sem nunca ter esquema vinculado. foraDoRoteiro sinaliza
// quando o local nem consta no roteiro (permanência inteira virou
// excedente — ver _aplicarEsquemaAoItem em tempo_permanencia.html).
export type ResumoAnaliseItemApoio = ResumoAnaliseItem & {
  permanenciaMin?: number | null | undefined;
  permitidoMin?: number | null | undefined;
  foraDoRoteiro?: boolean | undefined;
};

const MOTIVO_CORES_PADRAO: Record<string, string> = {
  ANTECIPADO: "#f0c040",
  INICIO_VIAGEM: "#3b82c4",
  EMBARQUE: "#22c97a",
  OCORRENCIA: "#8b5cf6",
  RELATORIO_GERADO: "#e05050",
};

function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildResumoAnalisePdfHtml(args: {
  regiao: string;
  dataLabel: string;
  analisadoPor?: string | null | undefined;
  itens: ResumoAnaliseItem[];
  itensApoio?: ResumoAnaliseItemApoio[] | undefined;
  logoDataUri?: string | null | undefined;
}): string {
  const { regiao, dataLabel, analisadoPor, itens, logoDataUri } = args;
  const itensApoio = args.itensApoio ?? [];

  const veiculos = new Set<string>();
  const porMotivo = new Map<string, { label: string; cor: string; count: number }>();
  let maiorExcedente = 0;

  for (const it of itens) {
    veiculos.add(it.veiculo);
    maiorExcedente = Math.max(maiorExcedente, Number(it.excedenteMin) || 0);
    const m = it.motivo || "—";
    const prev = porMotivo.get(m) ?? {
      label: it.motivoLabel || m,
      cor: it.motivoCor || MOTIVO_CORES_PADRAO[m] || "#9ca3af",
      count: 0,
    };
    porMotivo.set(m, { ...prev, count: prev.count + 1 });
  }

  const culpaCount = porMotivo.get("RELATORIO_GERADO")?.count ?? 0;
  const descarteCount = itens.length - culpaCount;

  const motivosOrdenados = [...porMotivo.values()].sort((a, b) => b.count - a.count);
  const maxMotivoCount = motivosOrdenados[0]?.count ?? 1;

  const distRows = motivosOrdenados
    .map((m) => {
      const pct = Math.round((m.count / maxMotivoCount) * 100);
      return `
      <tr>
        <td class="dist-name">${esc(m.label)}</td>
        <td class="dist-bar-cell">
          <div class="dist-bar-bg"><div class="dist-bar-fill" style="width:${pct}%;background:${m.cor};"></div></div>
        </td>
        <td class="dist-count">${m.count}</td>
      </tr>`;
    })
    .join("");

  const ordenados = [...itens].sort(
    (a, b) => a.veiculo.localeCompare(b.veiculo) || a.entrada.localeCompare(b.entrada),
  );

  const linhasTabela = ordenados
    .map((it, idx) => {
      const num = String(idx + 1).padStart(2, "0");
      const local =
        esc(it.ponto) +
        (it.cidade ? ` <span class="occ-sub">(${esc(it.cidade)}${it.uf ? " - " + esc(it.uf) : ""})</span>` : "");
      const cor = it.motivoCor || MOTIVO_CORES_PADRAO[it.motivo ?? ""] || "#9ca3af";
      const rowClass = idx % 2 === 0 ? "row-even" : "row-odd";
      return `
      <tr class="${rowClass}">
        <td class="occ-num occ-td">${num}</td>
        <td class="occ-td col-nowrap" style="font-family:monospace;font-weight:700;">${esc(it.veiculo)}</td>
        <td class="occ-td">${local}</td>
        <td class="occ-td col-nowrap col-center">${esc(it.entrada)}</td>
        <td class="occ-td col-nowrap col-center">${esc(it.saida)}</td>
        <td class="occ-td col-nowrap col-center" style="font-weight:700;color:#f47920;">${it.excedenteMin != null ? "+" + it.excedenteMin + " min" : "—"}</td>
        <td class="occ-td col-nowrap col-center"><span class="motivo-badge" style="background:${cor};">${esc(it.motivoLabel)}</span></td>
        <td class="occ-td" style="font-size:7.5pt;color:#6b7280;">${esc(it.detalhe || "—")}</td>
      </tr>`;
    })
    .join("");

  // ── Ponto de apoio — tabela própria, separada da rodoviária acima ──
  // (não entra no resumo/distribuição por motivo do topo, que continua
  // só rodoviária). "Excedente" cai pra "—" quando o item nunca teve
  // esquema vinculado (descartado por justificativa sem "Ver esquema").
  const veiculosApoio = new Set<string>();
  let maiorExcedenteApoio = 0;
  for (const it of itensApoio) {
    veiculosApoio.add(it.veiculo);
    maiorExcedenteApoio = Math.max(maiorExcedenteApoio, Number(it.excedenteMin) || 0);
  }

  const ordenadosApoio = [...itensApoio].sort(
    (a, b) => a.veiculo.localeCompare(b.veiculo) || a.entrada.localeCompare(b.entrada),
  );

  const linhasTabelaApoio = ordenadosApoio
    .map((it, idx) => {
      const num = String(idx + 1).padStart(2, "0");
      const local =
        esc(it.ponto) +
        (it.foraDoRoteiro
          ? ` <span class="occ-sub" style="color:#e05050;">(fora do roteiro)</span>`
          : it.cidade ? ` <span class="occ-sub">(${esc(it.cidade)}${it.uf ? " - " + esc(it.uf) : ""})</span>` : "");
      const cor = it.motivoCor || MOTIVO_CORES_PADRAO[it.motivo ?? ""] || "#9ca3af";
      const rowClass = idx % 2 === 0 ? "row-even" : "row-odd";
      const permanenciaTxt = it.permanenciaMin != null ? it.permanenciaMin + " min" : "—";
      const permitidoTxt = it.permitidoMin != null ? it.permitidoMin + " min" : "—";
      return `
      <tr class="${rowClass}">
        <td class="occ-num occ-td">${num}</td>
        <td class="occ-td col-nowrap" style="font-family:monospace;font-weight:700;">${esc(it.veiculo)}</td>
        <td class="occ-td">${local}</td>
        <td class="occ-td col-nowrap col-center">${esc(it.entrada)}</td>
        <td class="occ-td col-nowrap col-center">${esc(it.saida)}</td>
        <td class="occ-td col-nowrap col-center">${permanenciaTxt}</td>
        <td class="occ-td col-nowrap col-center">${permitidoTxt}</td>
        <td class="occ-td col-nowrap col-center" style="font-weight:700;color:#f47920;">${it.excedenteMin != null ? "+" + it.excedenteMin + " min" : "—"}</td>
        <td class="occ-td col-nowrap col-center"><span class="motivo-badge" style="background:${cor};">${esc(it.motivoLabel)}</span></td>
        <td class="occ-td" style="font-size:7.5pt;color:#6b7280;">${esc(it.detalhe || "—")}</td>
      </tr>`;
    })
    .join("");

  const secaoApoioHtml = itensApoio.length === 0 ? "" : `
  <div class="section-header" style="${itens.length > 0 ? "page-break-before: always;" : ""}">Excesso em Ponto de Apoio</div>
  <table class="summary-table"><tr>
    <td class="summary-cell"><div class="summary-number">${itensApoio.length}</div><div class="summary-label">Analisadas</div></td>
    <td class="summary-cell"><div class="summary-number">${veiculosApoio.size}</div><div class="summary-label">Veículos</div></td>
    <td class="summary-cell"><div class="summary-number">+${maiorExcedenteApoio}</div><div class="summary-label">Maior excedente (min)</div></td>
  </tr></table>
  <table class="occ-table" cellspacing="0" cellpadding="0">
    <thead>
      <tr>
        <th class="occ-th" style="width:22px;text-align:center;">#</th>
        <th class="occ-th" style="width:56px;">Veículo</th>
        <th class="occ-th">Ponto de apoio</th>
        <th class="occ-th" style="width:52px;">Chegada</th>
        <th class="occ-th" style="width:48px;">Saída</th>
        <th class="occ-th" style="width:64px;">Permanência</th>
        <th class="occ-th" style="width:64px;">Permitido</th>
        <th class="occ-th" style="width:64px;">Excedente</th>
        <th class="occ-th" style="width:112px;">Motivo</th>
        <th class="occ-th">Detalhe</th>
      </tr>
    </thead>
    <tbody>${linhasTabelaApoio}</tbody>
  </table>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Resumo de Análise — ${esc(regiao)}</title>
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

    .summary-table { width: 100%; border-collapse: separate; border-spacing: 6px 0; margin: 0 0 16px -6px; }
    .summary-cell { text-align: center; padding: 10px 6px; border: 1px solid #e5e7eb; border-radius: 4px; background: #fafafa; }
    .summary-number { font-size: 20pt; font-weight: 700; color: #1e293b; line-height: 1; }
    .summary-label { font-size: 8pt; color: #6b7280; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.4px; }
    .culpa-cell { background: #fef2f2; border-color: #fca5a5; } .culpa-cell .summary-number { color: #e05050; }
    .descarte-cell { background: #f0fdf4; border-color: #86efac; } .descarte-cell .summary-number { color: #22c97a; }

    .section-header { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #f47920; border-bottom: 2px solid #f47920; padding-bottom: 3px; margin-bottom: 8px; }

    .dist-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    .dist-name { font-size: 9.5pt; padding: 3px 6px 3px 0; width: 32%; }
    .dist-bar-cell { padding: 4px 8px; }
    .dist-bar-bg { background: #f3f4f6; border-radius: 3px; height: 10px; }
    .dist-bar-fill { height: 10px; border-radius: 3px; }
    .dist-count { font-size: 9.5pt; font-weight: 700; text-align: right; width: 30px; padding: 3px 0; }

    .occ-table { width: 100%; border-collapse: collapse; font-size: 8pt; border: 1px solid #d1d5db; }
    .occ-th { background: #f47920; color: #fff; font-weight: 700; padding: 6px 7px; text-align: left; font-size: 7.5pt; white-space: nowrap; border-right: 1px solid rgba(255,255,255,0.25); letter-spacing: 0.3px; }
    .occ-th:last-child { border-right: none; }
    .occ-num { padding: 5px 6px; color: #9ca3af; font-weight: 700; text-align: center; border-right: 1px solid #e5e7eb; white-space: nowrap; }
    .occ-td { padding: 5px 7px; vertical-align: middle; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
    .occ-td:last-child { border-right: none; }
    .occ-sub { color: #9ca3af; font-size: 7.5pt; }
    .col-nowrap { white-space: nowrap; }
    .col-center { text-align: center; }
    .occ-table tbody tr { break-inside: avoid; page-break-inside: avoid; }
    .row-even td { background: #fff; color: #111; }
    .row-odd  td { background: #f9fafb; color: #111; }
    .motivo-badge { display: inline-block; border-radius: 3px; font-size: 7pt; font-weight: 700; padding: 2px 6px; color: #fff; white-space: nowrap; }
  </style>
</head>
<body>

  <div class="report-header">
    <div class="report-header-logo">
      ${logoDataUri ? `<img src="${logoDataUri}" alt="Logo" />` : `<div style="width:110px;height:52px;background:#e2e8f0;border-radius:3px;"></div>`}
    </div>
    <div class="report-header-body">
      <div class="report-header-title">Resumo de Análise — Tempo de Permanência</div>
      <div class="report-header-sub">${esc(regiao)} &nbsp;·&nbsp; ${esc(dataLabel)} &nbsp;·&nbsp; ${itens.length + itensApoio.length} excedência${itens.length + itensApoio.length !== 1 ? "s" : ""} analisada${itens.length + itensApoio.length !== 1 ? "s" : ""}${analisadoPor ? ` &nbsp;·&nbsp; Por ${esc(analisadoPor)}` : ""}</div>
    </div>
  </div>

  <hr class="sep" />

  ${itens.length === 0 ? "" : `
  <table class="summary-table"><tr>
    <td class="summary-cell"><div class="summary-number">${itens.length}</div><div class="summary-label">Analisadas</div></td>
    <td class="summary-cell"><div class="summary-number">${veiculos.size}</div><div class="summary-label">Veículos</div></td>
    <td class="summary-cell"><div class="summary-number">+${maiorExcedente}</div><div class="summary-label">Maior excedente (min)</div></td>
    <td class="summary-cell culpa-cell"><div class="summary-number">${culpaCount}</div><div class="summary-label">Culpa do motorista</div></td>
    <td class="summary-cell descarte-cell"><div class="summary-number">${descarteCount}</div><div class="summary-label">Descartadas</div></td>
  </tr></table>

  ${motivosOrdenados.length ? `
  <div class="section-header">Distribuição por motivo</div>
  <table class="dist-table">${distRows}</table>` : ""}`}

  ${itens.length === 0 ? "" : `
  <div class="section-header" style="${itens.length > 12 ? "page-break-before: always;" : ""}">Listagem completa</div>
  <table class="occ-table" cellspacing="0" cellpadding="0">
    <thead>
      <tr>
        <th class="occ-th" style="width:22px;text-align:center;">#</th>
        <th class="occ-th" style="width:56px;">Veículo</th>
        <th class="occ-th">Ponto</th>
        <th class="occ-th" style="width:52px;">Chegada</th>
        <th class="occ-th" style="width:48px;">Saída</th>
        <th class="occ-th" style="width:64px;">Excedente</th>
        <th class="occ-th" style="width:112px;">Motivo</th>
        <th class="occ-th">Detalhe</th>
      </tr>
    </thead>
    <tbody>${linhasTabela}</tbody>
  </table>`}

  ${secaoApoioHtml}

</body>
</html>`;
}
