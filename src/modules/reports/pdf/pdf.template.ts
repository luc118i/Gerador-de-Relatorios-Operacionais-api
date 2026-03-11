import type { PdfDriver, PdfOccurrence } from "./pdf.types.js";
import { escapeHtml } from "./utils/pdf.utils.js";

type EvidenceInput = {
  dataUri: string;
  caption?: string | null;
  linkTexto?: string | null;
  linkUrl?: string | null;
};

export function buildOccurrencePdfHtml(args: {
  occurrence: PdfOccurrence;
  drivers: PdfDriver[];
  reportText: string;
  evidences: EvidenceInput[];
  logoDataUri?: string | null;
  footerCompany?: string | null;
  footerCnpj?: string | null;
}) {
  const {
    occurrence,
    drivers,
    reportText,
    evidences,
    logoDataUri,
    footerCompany,
    footerCnpj,
  } = args;

  const company = footerCompany ?? "KANDANGO TRANSPORTE E TURISMO LTDA";
  const cnpj = footerCnpj ?? "03.233.439/0001-52";

  const occurrenceTitle =
    occurrence.typeTitle ?? occurrence.typeCode ?? occurrence.typeId;

  const reportDateLabel = fmtDateBrFromDate(new Date());
  const tripDateLabel = fmtDateBr(occurrence.tripDate);
  const eventDateLabel = fmtDateBr(occurrence.eventDate);

  const eventTimeLabel = buildEventTimeLabel(
    occurrence.startTime,
    occurrence.endTime,
  );

  const driversHtml = buildDriversHtml(drivers);

  const relatoHtml = reportText?.trim()
    ? reportText
    : `<span class="muted">Sem texto.</span>`;

  const evidencesHtml = buildEvidencesHtml(evidences);

  const logoHtml = logoDataUri
    ? `<img class="logo" src="${logoDataUri}" alt="Logo" />`
    : `<div class="logo-spacer"></div>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Relatório de Ocorrência</title>

<style>

@page{
  margin-top:22mm;
  margin-right:16mm;
  margin-left:16mm;
  margin-bottom:25mm;
}

body{
  font-family:"Segoe UI","Inter",Arial,Helvetica,sans-serif;
  font-size:12pt;
  color:#000;
  margin:0;
}

/* HEADER */

.header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  margin-bottom:10px;
}

.logo{
  height:72px;
  display:block;
}

.logo-spacer{
  width:170px;
  height:72px;
}

.header-spacer{
  width:170px;
}

.header-title{
  flex:1;
  text-align:center;
  font-family:"Georgia","Times New Roman",serif;
  font-size:18pt;
  font-weight:700;
  letter-spacing:1.2px;
  line-height:1.15;
}

/* TABLE */

table.meta{
  width:100%;
  border-collapse:collapse;
  margin-top:6px;
  font-size:11.5pt;
}

table.meta td{
  border:1px solid #000;
  padding:6px 8px;
  vertical-align:top;
}

td.label{
  width:28%;
  font-weight:700;
  white-space:nowrap;
}

td.value{
  font-weight:400;
}

/* OCCURRENCE */

.occurrence{
  margin-top:10px;
  font-size:11.5pt;
  line-height:1.35;
}

.occurrence .row{
  margin:2px 0;
}

.label2{
  font-weight:700;
}

.separator{
  border:none;
  border-top:1px solid #000;
  margin:12px 0;
}

/* RELATO */

.relato{
  font-size:11.5pt;
  line-height:1.5;
  text-align:justify;
  margin-bottom:8px;
}

.section-title{
  margin:14px 0 6px;
  font-weight:700;
}

.muted{
  color:#666;
  font-size:11pt;
}

/* EVIDENCES */

figure.ev{
  margin:0 0 8px 0;
  break-inside:avoid;
  page-break-inside:avoid;
}

figure.ev img{
  width:100%;
  height:auto;
  max-height:62vh;
  object-fit:contain;
  display:block;
}

figure.ev figcaption{
  margin-top:6px;
  font-size:9.5pt;
  color:#444;
  line-height:1.25;
}

figure.ev a{
  color:#444;
  text-decoration:underline;
  font-size:9.5pt;
}

</style>
</head>

<body>

<div class="header">
${logoHtml}

<div class="header-title">
<div>RELATÓRIO DE</div>
<div>OCORRÊNCIA</div>
</div>

<div class="header-spacer"></div>
</div>

<table class="meta">

<tr>
<td class="label">Linha:</td>
<td class="value">${escapeHtml(occurrence.lineLabel ?? "—")}</td>
</tr>

<tr>
<td class="label">Veículo:</td>
<td class="value">${escapeHtml(occurrence.vehicleNumber)}</td>
</tr>

<tr>
<td class="label">Motorista:</td>
<td class="value">${driversHtml}</td>
</tr>

<tr>
<td class="label">Data Relatório:</td>
<td class="value">${escapeHtml(reportDateLabel)}</td>
</tr>

<tr>
<td class="label">Data da viagem:</td>
<td class="value">${escapeHtml(tripDateLabel)}</td>
</tr>

</table>

<div class="occurrence">

<div class="row">
<span class="label2">OCORRÊNCIA:</span>
${escapeHtml(occurrenceTitle)}
</div>

<div class="row">
<span class="label2">DATA:</span>
${escapeHtml(eventDateLabel)}
</div>

<div class="row">
<span class="label2">Horário do evento:</span>
${escapeHtml(eventTimeLabel)}
</div>

</div>

<hr class="separator"/>

<div class="relato">
${relatoHtml}
</div>

<div class="section-title">EVIDÊNCIAS</div>
${evidencesHtml}

</body>
</html>`;
}

/* -------------------------------------------------------------------------- */
/* Helpers */
/* -------------------------------------------------------------------------- */

function buildDriversHtml(drivers: PdfDriver[]) {
  if (!drivers.length) return "—";

  return drivers
    .map((d) => {
      const parts: string[] = [];

      if (d.code) parts.push(escapeHtml(d.code));
      parts.push(escapeHtml(d.name));
      if (d.baseCode) parts.push(escapeHtml(d.baseCode));

      return parts.join(" — ");
    })
    .join("<br/>");
}

function buildEventTimeLabel(start?: string | null, end?: string | null) {
  const startFmt = fmtTimeBr(start);
  const endFmt = fmtTimeBr(end);

  if (startFmt === "—") return "—";

  if (endFmt !== "—" && start !== end) {
    return `${startFmt} à ${endFmt}`;
  }

  return startFmt;
}

function buildEvidencesHtml(evidences: EvidenceInput[]) {
  if (!evidences.length) {
    return `<div class="muted">Sem evidências anexadas.</div>`;
  }

  return `<div class="evidences">
${evidences.map(buildEvidenceFigure).join("")}
</div>`;
}

function buildEvidenceFigure(e: EvidenceInput) {
  const captionParts: string[] = [];

  const cap = (e.caption ?? "").trim();
  const linkTexto = (e.linkTexto ?? "").trim();
  let linkUrl = (e.linkUrl ?? "").trim();

  if (linkUrl && !/^https?:\/\//i.test(linkUrl)) {
    linkUrl = "https://" + linkUrl;
  }

  if (cap) {
    captionParts.push(escapeHtml(cap));
  }

  if (linkUrl) {
    const label = linkTexto || "Acessar evidência";

    captionParts.push(
      `<a href="${escapeHtml(linkUrl)}" target="_blank">${escapeHtml(label)}</a>`,
    );
  }

  const captionHtml =
    captionParts.length > 0
      ? `<figcaption>${captionParts.join("<br/>")}</figcaption>`
      : "";

  return `
<figure class="ev">
<img src="${e.dataUri}" alt="Evidência"/>
${captionHtml}
</figure>`;
}

/* -------------------------------------------------------------------------- */
/* Format helpers */
/* -------------------------------------------------------------------------- */

function fmtDateBr(iso?: string | null) {
  if (!iso) return "—";

  const parts = iso.split("-");
  if (parts.length !== 3) return iso;

  const [y, m, d] = parts;
  if (!y || !m || !d) return iso;

  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function fmtDateBrFromDate(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());

  return `${dd}/${mm}/${yyyy}`;
}

function fmtTimeBr(t?: string | null) {
  if (!t) return "—";

  const [hh, mm] = t.split(":");

  if (!hh || !mm) return "—";

  return `${hh}h${mm}`;
}
