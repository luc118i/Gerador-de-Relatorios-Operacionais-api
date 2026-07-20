// solicitacao-mudanca.template.ts
// Relatório "Solicitação de Mudança" — grade real × programado agregada de
// várias viagens importadas (Análise em Massa / HistoricoHorariosStore.getPivot
// no lado do Apps Script), para embasar pedido de ajuste de horário comercial.
// Cabeçalho/rodapé seguem o mesmo padrão visual dos demais relatórios deste
// sistema (doc-header laranja E07B1F, seções com header escuro #1d1d1d) —
// texto do banner mantido como "ANÁLISE OPERACIONAL / RELATÓRIO DE VIAGEM"
// pra ficar fiel ao modelo de referência usado pela operação.

export interface SolicitacaoMudancaLocal {
  local: string;
  tempoDeslocamento?: string | null | undefined;
  programado?: string | null | undefined;
  porData: Record<string, string | null | undefined>;
  sugestao?: string | null | undefined;
  diffMin?: number | null | undefined;
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtDateBrFromDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

/** "19:00" -> "19h00" (mesma convenção do relatório de viagem única). */
function fmtHoraViagem(hhmm: string): string {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1]}h${m[2]}` : hhmm;
}

/**
 * "08/07/2026","10/07/2026","12/07/2026","16/07/2026" -> "8, 10, 12, 16/07"
 * (dia sem zero à esquerda, mês só uma vez ao final) — quando as datas
 * cruzam mais de um mês, cai no fallback "DD/MM, DD/MM" completo.
 */
function fmtPeriodo(datas: string[]): string {
  const partes = datas
    .map((d) => {
      const m = String(d || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      return m ? { dia: m[1], mes: m[2] } : null;
    })
    .filter((p): p is { dia: string; mes: string } => p !== null);

  if (partes.length === 0) return "—";

  const mesesDistintos = new Set(partes.map((p) => p.mes));
  if (mesesDistintos.size === 1) {
    const dias = partes.map((p) => String(Number(p.dia)));
    return `${dias.join(", ")}/${partes[0]!.mes}`;
  }
  return partes.map((p) => `${p.dia}/${p.mes}`).join(", ");
}

export function buildSolicitacaoMudancaPdfHtml(args: {
  itinerario: string;
  codigoViagem?: string | null;
  horarioViagem?: string | null;
  datas: string[];
  locais: SolicitacaoMudancaLocal[];
  logoDataUri?: string | null;
}): string {
  const { datas, locais, logoDataUri } = args;

  const itinerario = esc(args.itinerario || "—");
  const codigoViagem = (args.codigoViagem || "").trim();
  const horarioViagem = esc(args.horarioViagem ? fmtHoraViagem(args.horarioViagem) : "—");
  const periodoLabel = esc(fmtPeriodo(datas));
  const reportDateLabel = esc(fmtDateBrFromDate(new Date()));

  const logoHtml = logoDataUri
    ? `<img class="logo" src="${logoDataUri}" alt="Logo" />`
    : `<div class="logo-spacer"></div>`;

  const itinerarioValor = codigoViagem
    ? `${itinerario}<div class="sub">${esc(codigoViagem)}</div>`
    : itinerario;

  const dadosRows =
    `<tr><td class="lbl">Itiner&#225;rio:</td><td class="val">${itinerarioValor}</td><td class="lbl">Hor&#225;rio da Viagem:</td><td class="val">${horarioViagem}</td></tr>` +
    `<tr><td class="lbl">Per&#237;odo:</td><td class="val">${periodoLabel}</td><td class="lbl">Data do Relat&#243;rio:</td><td class="val">${reportDateLabel}</td></tr>`;

  const dateHeaders = datas
    .map((d) => {
      const m = String(d || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      return `<th class="c-num">${m ? esc(`${m[1]}/${m[2]}`) : esc(d)}</th>`;
    })
    .join("");

  const linhas = locais
    .map((loc) => {
      const cols = datas
        .map((d) => {
          const v = loc.porData ? loc.porData[d] : "";
          return `<td class="c-num">${v ? esc(v) : "&#8212;"}</td>`;
        })
        .join("");

      const desvioClasse =
        loc.diffMin == null ? "" : Math.abs(loc.diffMin) >= 10 ? "sug-atencao" : "sug-ok";

      return `
      <tr>
        <td class="c-local">${esc(loc.local)}</td>
        <td class="c-num">${loc.tempoDeslocamento ? esc(loc.tempoDeslocamento) : "&#8212;"}</td>
        <td class="c-num c-programado">${loc.programado ? esc(loc.programado) : "&#8212;"}</td>
        ${cols}
        <td class="c-num c-sugestao ${desvioClasse}">${loc.sugestao ? esc(loc.sugestao) : "&#8212;"}</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>An&#225;lise Operacional &#8212; Solicita&#231;&#227;o de Mudan&#231;a</title>
  <style>
    /* Landscape: a grade tem uma coluna por viagem importada (pode passar
       de 6-7 datas), o que fica muito apertado em retrato — a largura
       extra ajuda a caber sem espremer o texto. */
    @page { size: A4 landscape; margin-top: 15mm; margin-right: 14mm; margin-left: 14mm; margin-bottom: 20mm; }
    * { box-sizing: border-box; }
    /* display:flex no body quebra a paginação do Chromium (page.pdf): um
       container flex não fragmenta corretamente entre páginas, então
       conteúdo que precisa de mais de uma página física fica cortado/
       espremido numa única página. Fluxo normal (sem flex) deixa o
       navegador paginar a tabela linha a linha via page-break-inside:auto
       — a assinatura só fica com uma margem generosa antes dela em vez de
       grudada no rodapé exato da página. */
    body {
      font-family: "Segoe UI", Arial, Helvetica, sans-serif; font-size: 10.5pt; color: #111;
      margin: 0; padding: 0; background: #fff;
    }

    /* Cabeçalho (padrão GENERICO/ANALISE_OP) */
    .doc-header { display: flex; align-items: stretch; margin-bottom: 12px; border: 1px solid #ccc; }
    .header-logo-wrap { display: flex; align-items: center; justify-content: center; padding: 10px 16px; background: #fff; min-width: 160px; }
    .logo { height: 60px; display: block; }
    .logo-spacer { width: 120px; height: 60px; }
    .header-divider { width: 1px; background: #ccc; flex-shrink: 0; }
    .header-title-wrap { flex: 1; background: #E07B1F; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 20px; }
    .header-main-title { font-size: 16pt; font-weight: 700; color: #fff; letter-spacing: 0.8px; line-height: 1.15; text-align: center; text-transform: uppercase; }
    .header-sub-title { font-size: 10.5pt; font-weight: 700; color: #FFF6EC; margin-top: 2px; text-align: center; letter-spacing: 0.5px; text-transform: uppercase; }

    /* Seções */
    .section { margin-top: 8px; border: 1px solid #bbb; overflow: hidden; page-break-inside: avoid; }
    .section-hd { background: #1d1d1d; color: #fff; padding: 6px 10px; font-size: 10pt; font-weight: 700; letter-spacing: 0.4px; }
    /* A seção da grade de horários precisa poder quebrar entre páginas —
       "avoid" (padrão de .section) tenta manter a seção inteira numa única
       página, o que briga com table.hor{page-break-inside:auto} e faz
       linhas da tabela ficarem cortadas/somem quando ela não cabe numa
       página só. overflow:visible pelo mesmo motivo. */
    .section-tabela-longa { page-break-inside: auto; overflow: visible; }

    /* Tabela DADOS DA VIAGEM */
    table.dt { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
    table.dt td { border: 1px solid #ccc; padding: 6px 10px; vertical-align: middle; }
    table.dt td.lbl { font-weight: 700; background: #FDF5EE; width: 21%; white-space: nowrap; }
    table.dt td.val { background: #fff; width: 29%; }
    table.dt td.val .sub { font-size: 9pt; color: #666; margin-top: 2px; }

    /* Tabela de horários (real x programado) */
    table.hor { width: 100%; border-collapse: collapse; font-size: 9pt; page-break-inside: auto; }
    table.hor th, table.hor td { border: 1px solid #ccc; padding: 5px 6px; }
    table.hor thead th { background: #1d1d1d; color: #fff; font-weight: 700; text-align: center; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.3px; }
    table.hor tbody tr:nth-child(even) td { background: #fafafa; }
    table.hor .c-local { font-weight: 600; text-align: left; }
    table.hor .c-num { text-align: center; white-space: nowrap; }
    table.hor .c-programado { font-weight: 700; }
    table.hor .c-sugestao { font-weight: 700; }
    table.hor .sug-atencao { color: #c0121c; }
    table.hor .sug-ok { color: #385623; }

    /* Assinaturas */
    table.sig { width: 100%; border-collapse: collapse; margin-top: 6px; }
    table.sig td { width: 50%; border: none; padding: 0 20px; vertical-align: bottom; }
    .sig-line { border-bottom: 1px solid #444; margin-top: 34px; }
    .sig-label { text-align: center; color: #666; font-size: 8pt; margin-top: 6px; }
    .sig-role { text-align: center; color: #111; font-size: 9.5pt; font-weight: 700; margin-top: 2px; }
  </style>
</head>
<body>

  <!-- CABEÇALHO -->
  <div class="doc-header">
    <div class="header-logo-wrap">${logoHtml}</div>
    <div class="header-divider"></div>
    <div class="header-title-wrap">
      <div class="header-main-title">AN&#193;LISE OPERACIONAL</div>
      <div class="header-sub-title">RELAT&#211;RIO DE VIAGEM</div>
    </div>
  </div>

  <!-- DADOS DA VIAGEM -->
  <div class="section">
    <div class="section-hd">DADOS DA VIAGEM</div>
    <table class="dt">${dadosRows}</table>
  </div>

  <!-- GRADE DE HORÁRIOS -->
  <div class="section section-tabela-longa">
    <div class="section-hd">LOCAIS COM MAIOR DESVIO DE HOR&#193;RIO</div>
    <table class="hor">
      <thead>
        <tr>
          <th class="c-local">Local</th>
          <th class="c-num">Temp. Desl.</th>
          <th class="c-num">Programado</th>
          ${dateHeaders}
          <th class="c-num">Sugest&#227;o</th>
        </tr>
      </thead>
      <tbody>
        ${linhas}
      </tbody>
    </table>
  </div>

  <!-- ASSINATURAS — margem fixa generosa antes, em vez de empurrar pro
       rodapé exato da página (isso exigiria flex no body, que quebra a
       paginação de tabelas longas — ver nota no <style> acima). -->
  <div class="sig-wrap" style="margin-top:40px; page-break-inside: avoid;">
    <div class="section" style="border:none; margin-top:26px;">
      <div class="section-hd">ASSINATURAS</div>
    </div>
    <table class="sig">
      <tr>
        <td><div class="sig-line"></div><div class="sig-label">Assinatura</div></td>
        <td><div class="sig-line"></div><div class="sig-label">Assinatura</div></td>
      </tr>
      <tr>
        <td class="sig-role">Aprovador 1</td>
        <td class="sig-role">Aprovador 2</td>
      </tr>
    </table>
  </div>

</body>
</html>`;
}
