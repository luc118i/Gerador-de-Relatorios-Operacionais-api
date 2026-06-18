import type { TempoPermanenciaMap } from "../../telemetry/repositories/tempo-permanencia.repo.js";
import { getStopLimit } from "../../telemetry/constants/stop-thresholds.js";
import { formatDuration, formatDatetimeFull, toMinutes } from "../../../shared/time/index.js";
import { normalizeText } from "../../../shared/normalizer/index.js";

type Point = {
  seq: number;
  ponto: string;
  entrada: string | null;
  saida: string | null;
  parada_s: number;
  rodoviaria?: boolean;
  garagem?: boolean;
  tipo?: string | null;
  matched?: boolean;
};

/** Uma parada que ultrapassou o tempo de permanência permitido. */
export interface ExcessoParada {
  seq: number;
  ponto: string;
  entrada: string | null;
  saida: string | null;
  paradaS: number;
  permitidoMin: number;
  excessoS: number;
  classificacao: string;
  fonte: "cadastro" | "padrão";
  nivel: "attention" | "critical";
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function classificar(p: Point): string {
  if (p.rodoviaria) return "Rodoviária";
  if (p.garagem) return "Garagem";
  return "Ponto comum";
}

/**
 * Extrai as paradas em excesso a partir dos pontos da análise.
 * Usa o tempo cadastrado em TEMPO_PERMANENCIA por ORIGEM; quando o ponto
 * não está cadastrado, cai no limite padrão (rodoviária/garagem/comum).
 */
export function extractExcessos(points: Point[], tempoMap: TempoPermanenciaMap): ExcessoParada[] {
  const out: ExcessoParada[] = [];

  for (const p of points) {
    if (!p.parada_s || p.parada_s <= 0) continue;

    const paradaMin = toMinutes(p.parada_s);

    const cadastrado = tempoMap.get(normalizeText(p.ponto));

    let permitidoMin: number;
    let limiteEfetivoMin: number; // a partir do qual conta como excesso
    let fonte: ExcessoParada["fonte"];

    if (cadastrado != null) {
      permitidoMin = cadastrado;
      limiteEfetivoMin = cadastrado; // sem tolerância: tempo permitido é estrito
      fonte = "cadastro";
    } else {
      const limite = getStopLimit({ rodoviaria: !!p.rodoviaria, garagem: !!p.garagem });
      permitidoMin = limite.esperadoMin;
      limiteEfetivoMin = limite.esperadoMin + limite.toleranciaMin;
      fonte = "padrão";
    }

    if (paradaMin <= limiteEfetivoMin) continue;

    const excessoS = Math.max(0, Math.round(p.parada_s - permitidoMin * 60));
    const nivel: ExcessoParada["nivel"] = paradaMin > permitidoMin * 2 ? "critical" : "attention";

    out.push({
      seq: p.seq,
      ponto: p.ponto,
      entrada: p.entrada,
      saida: p.saida,
      paradaS: p.parada_s,
      permitidoMin,
      excessoS,
      classificacao: classificar(p),
      fonte,
      nivel,
    });
  }

  // Maior excesso primeiro
  return out.sort((a, b) => b.excessoS - a.excessoS);
}

function fmtDateBr(iso: string): string {
  const v = (iso ?? "").trim();
  const parts = v.split("-");
  if (parts.length !== 3) return v || "—";
  const [y, m, d] = parts;
  if (!y || !m || !d) return v || "—";
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function fmtDateBrFromDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

/** Texto padrão da ocorrência, com prefixo, data e tempo de excesso em destaque. */
function buildRelatoHtml(prefixo: string, tripDateLabel: string, totalExcessoS: number, qtd: number): string {
  const excessoLabel =
    qtd > 1
      ? `excesso total de ${formatDuration(totalExcessoS)} distribuído em ${qtd} paradas`
      : `tempo de excesso de ${formatDuration(totalExcessoS)}`;

  return `
    <p>Durante a análise das atividades do veículo de número <strong>${esc(prefixo)}</strong> na viagem do dia <strong>${esc(tripDateLabel)}</strong>, identificamos o descumprimento operacional por parte do condutor, em razão da permanência superior ao tempo previsto em ponto de parada (<strong>${esc(excessoLabel)}</strong>).</p>
    <p>Esta conduta caracteriza uma violação dos procedimentos operacionais estabelecidos, impactando diretamente a programação da viagem, gerando atrasos e comprometendo a qualidade do serviço prestado aos passageiros.</p>
    <p>Além disso, a ocorrência ocasiona desconformidade em relação aos horários divulgados no ato da comercialização das passagens, afetando a confiabilidade das informações fornecidas aos clientes.</p>
  `;
}

export function buildExcessoParadaReportHtml(args: {
  prefixo: string;
  dataViagem: string;          // YYYY-MM-DD
  motorista?: string | null;
  dataEvento?: string | null;  // YYYY-MM-DD
  excessos: ExcessoParada[];
  logoDataUri?: string | null;
}): string {
  const { excessos, logoDataUri } = args;

  const prefixo = (args.prefixo ?? "").trim() || "—";
  const motorista = (args.motorista ?? "").trim();
  const tripDateLabel = fmtDateBr(args.dataViagem ?? "");
  const eventoLabel = (args.dataEvento ?? "").trim() ? fmtDateBr(args.dataEvento!) : "";
  const reportDateLabel = fmtDateBrFromDate(new Date());

  const totalExcessoS = excessos.reduce((acc, e) => acc + e.excessoS, 0);

  const logoHtml = logoDataUri
    ? `<img class="logo" src="${logoDataUri}" alt="Logo" />`
    : `<div class="logo-spacer"></div>`;

  // Linhas da seção DADOS DA VIAGEM (campos opcionais são omitidos)
  const dadosRows = [
    `<tr><td class="lbl">Prefixo do Ve&#237;culo:</td><td class="val">${esc(prefixo)}</td><td class="lbl">Data da Viagem:</td><td class="val">${esc(tripDateLabel)}</td></tr>`,
    eventoLabel
      ? `<tr><td class="lbl">Data do Evento:</td><td class="val">${esc(eventoLabel)}</td><td class="lbl">Data do Relat&#243;rio:</td><td class="val">${esc(reportDateLabel)}</td></tr>`
      : `<tr><td class="lbl">Data do Relat&#243;rio:</td><td class="val" colspan="3">${esc(reportDateLabel)}</td></tr>`,
    motorista
      ? `<tr><td class="lbl">Motorista:</td><td class="val" colspan="3">${esc(motorista)}</td></tr>`
      : "",
  ].join("");

  const relatoHtml = excessos.length > 0
    ? buildRelatoHtml(prefixo, tripDateLabel, totalExcessoS, excessos.length)
    : `<p><em>Nenhuma parada excedeu o tempo de permanência permitido nesta viagem.</em></p>`;

  // ── Tabela de paradas em excesso ────────────────────────────────────────────
  const linhas = excessos
    .map(
      (e) => `
      <tr>
        <td class="c-ponto">${esc(e.ponto)}</td>
        <td class="c-cls">${esc(e.classificacao)}</td>
        <td class="c-dt">${e.entrada ? esc(formatDatetimeFull(e.entrada)) : "—"}</td>
        <td class="c-dt">${e.saida ? esc(formatDatetimeFull(e.saida)) : "—"}</td>
        <td class="c-num">${esc(formatDuration(e.paradaS))}</td>
        <td class="c-num">${e.permitidoMin}min</td>
        <td class="c-num c-exc ${e.nivel === "critical" ? "exc-crit" : "exc-warn"}">${esc(formatDuration(e.excessoS))}</td>
      </tr>`,
    )
    .join("");

  const tabelaHtml = excessos.length === 0
    ? ""
    : `
    <div class="section">
      <div class="section-hd">PARADAS COM EXCESSO DE PERMAN&#202;NCIA</div>
      <table class="exc">
        <thead>
          <tr>
            <th class="c-ponto">Ponto</th>
            <th class="c-cls">Classifica&#231;&#227;o</th>
            <th class="c-dt">Entrada</th>
            <th class="c-dt">Sa&#237;da</th>
            <th class="c-num">Perman&#234;ncia</th>
            <th class="c-num">Permitido</th>
            <th class="c-num">Excesso</th>
          </tr>
        </thead>
        <tbody>
          ${linhas}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="6" class="c-foot">Excesso total</td>
            <td class="c-num c-exc exc-crit">${esc(formatDuration(totalExcessoS))}</td>
          </tr>
        </tfoot>
      </table>
      <div class="legenda">
        Tempo permitido conforme cadastro por ponto (TEMPO_PERMAN&#202;NCIA). Pontos sem cadastro usam o limite padr&#227;o
        (Rodovi&#225;ria 15min &#183; Garagem 20min &#183; Ponto comum 40min, com 5min de toler&#226;ncia).
      </div>
    </div>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Relat&#243;rio de Ocorr&#234;ncia &#8212; Excesso de Perman&#234;ncia</title>
  <style>
    @page { size: A4; margin-top: 15mm; margin-right: 14mm; margin-left: 14mm; margin-bottom: 20mm; }
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Arial, Helvetica, sans-serif; font-size: 10.5pt; color: #111; margin: 0; padding: 0; background: #fff; }

    /* Cabeçalho (padrão GENERICO) */
    .doc-header { display: flex; align-items: stretch; margin-bottom: 12px; border: 1px solid #ccc; }
    .header-logo-wrap { display: flex; align-items: center; justify-content: center; padding: 10px 16px; background: #fff; min-width: 160px; }
    .logo { height: 60px; display: block; }
    .logo-spacer { width: 120px; height: 60px; }
    .header-divider { width: 1px; background: #ccc; flex-shrink: 0; }
    .header-title-wrap { flex: 1; background: #E07B1F; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 20px; }
    .header-main-title { font-size: 15pt; font-weight: 700; color: #fff; letter-spacing: 0.8px; line-height: 1.15; text-align: center; text-transform: uppercase; }
    .header-sub-title { font-size: 9.5pt; font-weight: 400; color: #fff; margin-top: 4px; text-align: center; letter-spacing: 0.5px; text-transform: uppercase; }

    /* Seções */
    .section { margin-top: 8px; border: 1px solid #bbb; overflow: hidden; page-break-inside: avoid; }
    .section-hd { background: #1d1d1d; color: #fff; padding: 6px 10px; font-size: 10pt; font-weight: 700; letter-spacing: 0.4px; }

    /* Tabela de dados da viagem */
    table.dt { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
    table.dt td { border: 1px solid #ccc; padding: 6px 10px; vertical-align: middle; }
    table.dt td.lbl { font-weight: 700; background: #FDF5EE; width: 21%; white-space: nowrap; }
    table.dt td.val { background: #fff; width: 29%; }

    /* Relato */
    .text-area { padding: 10px 12px; font-size: 10.5pt; line-height: 1.6; text-align: justify; background: #fff; }
    .text-area p { margin: 0 0 8px 0; }
    .text-area strong { font-weight: 700; }

    /* Tabela de excessos */
    table.exc { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    table.exc th, table.exc td { border: 1px solid #ccc; padding: 5px 7px; }
    table.exc thead th { background: #FDF5EE; font-weight: 700; text-align: left; }
    table.exc tbody tr:nth-child(even) td { background: #fafafa; }
    .c-num { text-align: right; white-space: nowrap; }
    .c-ponto { font-weight: 600; }
    .c-dt { color: #444; white-space: nowrap; }
    .c-cls { color: #555; }
    .c-exc { font-weight: 700; }
    .exc-crit { color: #b91c1c; }
    .exc-warn { color: #b45309; }
    table.exc tfoot td { background: #f3f4f6; font-weight: 700; }
    .c-foot { text-align: right; }
    .legenda { padding: 8px 10px; font-size: 8.5pt; color: #666; line-height: 1.35; background: #fff; }
  </style>
</head>
<body>

  <!-- CABEÇALHO -->
  <div class="doc-header">
    <div class="header-logo-wrap">${logoHtml}</div>
    <div class="header-divider"></div>
    <div class="header-title-wrap">
      <div class="header-main-title">RELAT&#211;RIO DE OCORR&#202;NCIA</div>
      <div class="header-sub-title">Excesso de Perman&#234;ncia em Ponto de Parada</div>
    </div>
  </div>

  <!-- DADOS DA VIAGEM -->
  <div class="section">
    <div class="section-hd">DADOS DA VIAGEM</div>
    <table class="dt">${dadosRows}</table>
  </div>

  <!-- RELATO DA OCORRÊNCIA -->
  <div class="section">
    <div class="section-hd">RELATO DA OCORR&#202;NCIA</div>
    <div class="text-area">${relatoHtml}</div>
  </div>

  <!-- PARADAS EM EXCESSO -->
  ${tabelaHtml}

</body>
</html>`;
}
