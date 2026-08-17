import type { PdfDriver, PdfOccurrence } from "./pdf.types.js";
import { formatDuration } from "../../../shared/time/index.js";

/** Um local não autorizado visitado, dentro de uma ocorrência
 * DESCUMP_OP_PARADA_FORA agrupando N pontos (ver occurrence_points). */
export interface ParadaForaPonto {
  seq: number;
  ponto: string;
  entrada: string | null; // HH:mm
  saida: string | null;   // HH:mm
  duracaoS: number;       // tempo no local, em segundos (trata virada de meia-noite)
}

/** Minutos entre entrada e saída (HH:mm), tratando parada que cruza a
 * meia-noite (saída "menor" que entrada = dia seguinte). */
function calcDuracaoSegundos(entrada: string | null, saida: string | null): number {
  if (!entrada || !saida) return 0;
  const [hi, mi] = entrada.split(":").map(Number);
  const [hf, mf] = saida.split(":").map(Number);
  if ([hi, mi, hf, mf].some((n) => Number.isNaN(n))) return 0;
  let totalMin = (hf! * 60 + mf!) - (hi! * 60 + mi!);
  if (totalMin <= 0) totalMin += 24 * 60;
  return totalMin * 60;
}

export interface ParadaForaEvidence {
  dataUri: string;
  caption?: string | null;
  linkTexto?: string | null;
  linkUrl?: string | null;
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function fmtTimeBr(hhmm: string | null): string {
  const v = (hhmm ?? "").trim();
  if (!v) return "—";
  const [hh, mm] = v.slice(0, 5).split(":");
  if (!hh || !mm) return v;
  return `${hh}h${mm}`;
}

/** Texto padrão da ocorrência, listando os locais não autorizados visitados. */
function buildRelatoHtml(prefixo: string, tripDateLabel: string, pontos: ParadaForaPonto[]): string {
  const locaisLabel =
    pontos.length > 1
      ? `${pontos.length} locais não autorizados (${pontos.map((p) => esc(p.ponto)).join(", ")})`
      : `local não autorizado <strong>${esc(pontos[0]?.ponto ?? "—")}</strong>`;

  return `
    <p>Durante a análise das atividades do veículo de número <strong>${esc(prefixo)}</strong> na viagem do dia <strong>${esc(tripDateLabel)}</strong>, identificamos o descumprimento operacional/comercial por parte do condutor, que realizou parada em <strong>${locaisLabel}</strong>, fora do esquema operacional pré-estabelecido.</p>
    <p>Esta conduta representa uma clara violação das normas e padrões operacionais, gerando atraso na viagem, prejudicando a qualidade do serviço prestado e comprometendo a confiabilidade das informações divulgadas no ato da venda dos bilhetes de passagens.</p>
  `;
}

/**
 * Relatório de "Parada Irregular" (DESCUMP_OP_PARADA_FORA) cobrindo N locais
 * não autorizados do mesmo veículo/viagem em 1 único PDF — equivalente, pro
 * tipo Parada Fora, do relatório em grupo de Excesso de Permanência
 * (excesso-parada.template.ts). Usado pelo "Gerar Múltiplo" de index.html.
 */
export function buildParadaForaMultiplaReportHtml(args: {
  occurrence: PdfOccurrence;
  drivers: PdfDriver[];
  evidences?: ParadaForaEvidence[];
  logoDataUri?: string | null;
}): string {
  const { occurrence, drivers } = args;
  const evidences = args.evidences ?? [];

  const pontos: ParadaForaPonto[] = (occurrence.points ?? []).map((p, i) => {
    const entrada = p.startTime ? p.startTime.slice(0, 5) : null;
    const saida = p.endTime ? p.endTime.slice(0, 5) : null;
    return {
      seq: i + 1,
      ponto: p.place || "—",
      entrada,
      saida,
      duracaoS: calcDuracaoSegundos(entrada, saida),
    };
  });

  const totalDuracaoS = pontos.reduce((acc, p) => acc + p.duracaoS, 0);

  const prefixo = (occurrence.vehicleNumber ?? "").trim() || "—";
  const linha = (occurrence.lineLabel ?? "").trim();
  const horarioSessao = (occurrence.sessionTime ?? "").trim();
  const tripDateLabel = fmtDateBr(occurrence.tripDate ?? "");
  const eventoLabel = (occurrence.eventDate ?? "").trim() ? fmtDateBr(occurrence.eventDate) : "";
  const reportDateLabel = fmtDateBrFromDate(new Date());

  const motorista = drivers
    .map((d) => [d.code, d.name || "—", d.baseCode].filter(Boolean).join(" - "))
    .join(" / ");

  const logoHtml = args.logoDataUri
    ? `<img class="logo" src="${args.logoDataUri}" alt="Logo" />`
    : `<div class="logo-spacer"></div>`;

  const dadosRows = [
    `<tr><td class="lbl">Prefixo do Ve&#237;culo:</td><td class="val">${esc(prefixo)}</td><td class="lbl">Data da Viagem:</td><td class="val">${esc(tripDateLabel)}</td></tr>`,
    linha && horarioSessao
      ? `<tr><td class="lbl">Linha:</td><td class="val">${esc(linha)}</td><td class="lbl">Hor&#225;rio de Sess&#227;o:</td><td class="val">${esc(horarioSessao)}</td></tr>`
      : linha
        ? `<tr><td class="lbl">Linha:</td><td class="val" colspan="3">${esc(linha)}</td></tr>`
        : horarioSessao
          ? `<tr><td class="lbl">Hor&#225;rio de Sess&#227;o:</td><td class="val" colspan="3">${esc(horarioSessao)}</td></tr>`
          : "",
    eventoLabel
      ? `<tr><td class="lbl">Data do Evento:</td><td class="val">${esc(eventoLabel)}</td><td class="lbl">Data do Relat&#243;rio:</td><td class="val">${esc(reportDateLabel)}</td></tr>`
      : `<tr><td class="lbl">Data do Relat&#243;rio:</td><td class="val" colspan="3">${esc(reportDateLabel)}</td></tr>`,
    motorista
      ? `<tr><td class="lbl">Motorista:</td><td class="val" colspan="3">${esc(motorista)}</td></tr>`
      : "",
  ].join("");

  const relatoHtml = pontos.length > 0
    ? buildRelatoHtml(prefixo, tripDateLabel, pontos)
    : `<p><em>Nenhum local não autorizado registrado nesta viagem.</em></p>`;

  const linhas = pontos
    .map(
      (p) => `
      <tr>
        <td class="c-ponto">${esc(p.ponto)}</td>
        <td class="c-dt">${esc(fmtTimeBr(p.entrada))}</td>
        <td class="c-dt">${esc(fmtTimeBr(p.saida))}</td>
        <td class="c-num">${esc(formatDuration(p.duracaoS))}</td>
      </tr>`,
    )
    .join("");

  const tabelaHtml = pontos.length === 0
    ? ""
    : `
    <div class="section">
      <div class="section-hd">LOCAIS N&#195;O AUTORIZADOS VISITADOS</div>
      <table class="exc">
        <thead>
          <tr>
            <th class="c-ponto">Local</th>
            <th class="c-dt">Entrada</th>
            <th class="c-dt">Sa&#237;da</th>
            <th class="c-num">Tempo no Local</th>
          </tr>
        </thead>
        <tbody>
          ${linhas}
          <tr class="tr-total">
            <td class="c-ponto" colspan="3">TEMPO TOTAL PERDIDO NESSAS PARADAS</td>
            <td class="c-num c-total">${esc(formatDuration(totalDuracaoS))}</td>
          </tr>
        </tbody>
      </table>
    </div>`;

  const evidenceHtml = evidences
    .map((e) => {
      const cap = (e.caption ?? "").trim();
      const linkTexto = (e.linkTexto ?? "").trim();
      let linkUrl = (e.linkUrl ?? "").trim();
      if (linkUrl && !/^https?:\/\//i.test(linkUrl)) linkUrl = "https://" + linkUrl;
      const captionParts: string[] = [];
      if (cap) captionParts.push(esc(cap));
      if (linkUrl) {
        captionParts.push(
          `<a href="${esc(linkUrl)}" target="_blank">${esc(linkTexto || "Acessar evidência")}</a>`,
        );
      }
      const finalCaption =
        captionParts.length > 0 ? `<figcaption>${captionParts.join("<br/>")}</figcaption>` : "";
      return `<figure class="ev"><img src="${e.dataUri}" alt="Evid&#234;ncia" />${finalCaption}</figure>`;
    })
    .join("");

  const evidenceSection =
    evidences.length === 0
      ? ""
      : `
    <div class="section">
      <div class="section-hd">REGISTRO FOTOGR&#193;FICO</div>
      <div class="ev-section">${evidenceHtml}</div>
    </div>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Relat&#243;rio de Ocorr&#234;ncia &#8212; Parada Irregular</title>
  <style>
    @page { size: A4; margin-top: 15mm; margin-right: 14mm; margin-left: 14mm; margin-bottom: 20mm; }
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Arial, Helvetica, sans-serif; font-size: 10.5pt; color: #111; margin: 0; padding: 0; background: #fff; }

    .doc-header { display: flex; align-items: stretch; margin-bottom: 12px; border: 1px solid #ccc; }
    .header-logo-wrap { display: flex; align-items: center; justify-content: center; padding: 10px 16px; background: #fff; min-width: 160px; }
    .logo { height: 60px; display: block; }
    .logo-spacer { width: 120px; height: 60px; }
    .header-divider { width: 1px; background: #ccc; flex-shrink: 0; }
    .header-title-wrap { flex: 1; background: #E07B1F; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 20px; }
    .header-main-title { font-size: 15pt; font-weight: 700; color: #fff; letter-spacing: 0.8px; line-height: 1.15; text-align: center; text-transform: uppercase; }
    .header-sub-title { font-size: 9.5pt; font-weight: 400; color: #fff; margin-top: 4px; text-align: center; letter-spacing: 0.5px; text-transform: uppercase; }

    .section { margin-top: 8px; border: 1px solid #bbb; overflow: hidden; page-break-inside: avoid; }
    .section-hd { background: #1d1d1d; color: #fff; padding: 6px 10px; font-size: 10pt; font-weight: 700; letter-spacing: 0.4px; }

    table.dt { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
    table.dt td { border: 1px solid #ccc; padding: 6px 10px; vertical-align: middle; }
    table.dt td.lbl { font-weight: 700; background: #FDF5EE; width: 21%; white-space: nowrap; }
    table.dt td.val { background: #fff; width: 29%; }

    .text-area { padding: 10px 12px; font-size: 10.5pt; line-height: 1.6; text-align: justify; background: #fff; }
    .text-area p { margin: 0 0 8px 0; }
    .text-area strong { font-weight: 700; }

    table.exc { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    table.exc th, table.exc td { border: 1px solid #ccc; padding: 5px 7px; }
    table.exc thead th { background: #FDF5EE; font-weight: 700; text-align: left; }
    table.exc tbody tr:nth-child(even) td { background: #fafafa; }
    .c-ponto { font-weight: 600; }
    .c-dt { color: #444; white-space: nowrap; }
    .c-num { text-align: right; white-space: nowrap; }
    table.exc tr.tr-total td { background: #FDF5EE; font-weight: 700; }
    table.exc tr.tr-total .c-ponto { text-align: right; }
    .c-total { color: #c0121c; font-size: 10.5pt; }

    .ev-section { padding: 12px 14px; background: #fff; }
    figure.ev { margin: 0 0 12px 0; break-inside: avoid; page-break-inside: avoid; }
    figure.ev img { width: 100%; height: auto; max-height: 60vh; object-fit: contain; display: block; border: 1px solid #ddd; }
    figure.ev figcaption { margin-top: 4px; font-size: 9pt; color: #555; line-height: 1.3; }
    figure.ev a { color: #555; text-decoration: underline; }
  </style>
</head>
<body>

  <div class="doc-header">
    <div class="header-logo-wrap">${logoHtml}</div>
    <div class="header-divider"></div>
    <div class="header-title-wrap">
      <div class="header-main-title">RELAT&#211;RIO DE OCORR&#202;NCIA</div>
      <div class="header-sub-title">Parada em Local N&#227;o Autorizado &#8212; M&#250;ltiplas Paradas</div>
    </div>
  </div>

  <div class="section">
    <div class="section-hd">DADOS DA VIAGEM</div>
    <table class="dt">${dadosRows}</table>
  </div>

  <div class="section">
    <div class="section-hd">RELATO DA OCORR&#202;NCIA</div>
    <div class="text-area">${relatoHtml}</div>
  </div>

  ${tabelaHtml}

  ${evidenceSection}

</body>
</html>`;
}
