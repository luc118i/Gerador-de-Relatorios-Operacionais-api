import type { PdfDriver, PdfOccurrence } from "./pdf.types.js";

type EvidenceInput = {
  dataUri: string;
  caption?: string | null;
  linkTexto?: string;
  linkUrl?: string;
};

export function buildOccurrencePdfHtml(args: {
  occurrence: PdfOccurrence;
  drivers: PdfDriver[];
  reportText: string;
  reportHtml?: string; // HTML pré-construído — bypassa o escapeHtml
  evidences: EvidenceInput[];

  logoDataUri?: string | null;
  footerCompany?: string | null;
  footerCnpj?: string | null;
}) {
  const { occurrence, drivers, reportText, evidences, logoDataUri } = args;

  const company = args.footerCompany ?? "KANDANGO TRANSPORTE E TURISMO LTDA";
  const cnpj = args.footerCnpj ?? "03.233.439/0001-52";

  const lineLabel = occurrence.lineLabel ?? "—";

  const driversLines =
    drivers.length > 0
      ? drivers
          .map((d) => {
            const parts: string[] = [];
            if (d.code) parts.push(escapeHtml(d.code)); // matrícula
            parts.push(escapeHtml(d.name)); // nome
            if (d.baseCode) parts.push(escapeHtml(d.baseCode)); // base
            return parts.join(" — ");
          })
          .join("<br/>")
      : "—";

  // Datas em dd/MM/aaaa (barra)
  const reportDateLabel = fmtDateBrFromDate(new Date());
  const tripDateLabel = fmtDateBr(occurrence.tripDate);
  const eventDateLabel = fmtDateBr(occurrence.eventDate);

  // Horário do evento (sem segundos) -> 12h59 à 13h47 (ou só 12h59 quando igual)
  const startFmt = occurrence.startTime ? fmtTimeBr(occurrence.startTime) : null;
  const endFmt = occurrence.endTime ? fmtTimeBr(occurrence.endTime) : null;
  const eventTimeLabel =
    startFmt && endFmt && startFmt !== endFmt
      ? `${startFmt} à ${endFmt}`
      : startFmt ?? "—";

  // ✅ Agora já suporta typeTitle/typeCode vindo do repo
  const occurrenceTitle =
    occurrence.typeTitle ?? occurrence.typeCode ?? occurrence.typeId;

  // RELATO:
  // - se vier reportText do usuário: escapa (seguro)
  // - se não vier: usa default com <strong> nas variáveis (bonito)
  const relatoHtml = args.reportHtml ?? buildRelatoHtml({
    reportText,
    fallbackPrefixo: occurrence.vehicleNumber,
    fallbackTripDateLabel: tripDateLabel,
  });

  const evidenceHtml =
    evidences.length === 0
      ? `<div class="muted">Sem evidências anexadas.</div>`
      : `<div class="evidences">
        ${evidences
          .map((e) => {
            const cap = (e.caption ?? "").trim();
            const linkTexto = (e.linkTexto ?? "").trim();
            let linkUrl = (e.linkUrl ?? "").trim();

            // normaliza URL (evita erro se usuário não colocar https)
            if (linkUrl && !/^https?:\/\//i.test(linkUrl)) {
              linkUrl = "https://" + linkUrl;
            }

            const captionParts: string[] = [];

            if (cap) {
              captionParts.push(escapeHtml(cap));
            }

            if (linkUrl) {
              const textoParaExibir = linkTexto || "Acessar evidência";

              captionParts.push(
                `<a href="${escapeHtml(linkUrl)}" target="_blank">
       ${escapeHtml(textoParaExibir)}
     </a>`,
              );
            }

            const finalCaption =
              captionParts.length > 0
                ? `<figcaption>${captionParts.join("<br/>")}</figcaption>`
                : "";

            return `
              <figure class="ev">
                <img src="${e.dataUri}" alt="Evidência" />
                ${finalCaption}
              </figure>
            `;
          })
          .join("")}
      </div>`;

  const logoHtml = logoDataUri
    ? `<img class="logo" src="${logoDataUri}" alt="Logo" />`
    : `<div class="logo-spacer"></div>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Relatório de Ocorrência</title>

  <style>
    @page {
      margin-top: 22mm;
      margin-right: 16mm;
      margin-left: 16mm;
      margin-bottom: 25mm;
    }

    body {
      font-family: "Segoe UI", "Inter", Arial, Helvetica, sans-serif;
      font-size: 12pt;
      color: #000;
      margin: 0;
    }

    /* CABEÇALHO */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
    }

    .logo { height: 72px; display: block; }
    .logo-spacer { width: 170px; height: 72px; }
    .header-spacer { width: 170px; }

    .header-title {
      flex: 1;
      text-align: center;

      font-family: "Georgia", "Times New Roman", serif; /* 👈 institucional */
      font-size: 18pt;
      font-weight: 700;

      letter-spacing: 1.2px;   /* mais formal */
      line-height: 1.15;
    }


    /* TABELA */
    table.meta {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      font-size: 11.5pt;
    }
    table.meta td {
      border: 1px solid #000;
      padding: 6px 8px;
      vertical-align: top;
    }
    td.label {
      width: 28%;
      font-weight: 700;
      white-space: nowrap;
    }
    td.value {
      font-weight: 400;
    }

    /* BLOCO OCORRÊNCIA */
    .occurrence {
      margin-top: 10px;
      font-size: 11.5pt;
      line-height: 1.35;
    }
    .occurrence .row { margin: 2px 0; }
    .occurrence .label2 { font-weight: 700; }

    hr.separator {
      border: none;
      border-top: 1px solid #000;
      margin: 12px 0 12px;
    }

    /* RELATO */
    .relato {
      font-size: 11.5pt;
      line-height: 1.5;
      text-align: justify;
    }

    .section-title {
      margin: 14px 0 6px;
      font-weight: 700;
    }

    .relato {
      margin-bottom: 8px;
    }



    .muted { color: #666; font-size: 11pt; }

    /* EVIDÊNCIAS: mais próximas, sem borda */
    .evidences {
      display: block;     /* grid não é necessário para 1 coluna */
    }


    figure.ev {
      margin: 0 0 8px 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    figure.ev img {
      width: 100%;
      height: auto;          /* deixa a imagem mandar */
      max-height: 62vh;      /* limite inteligente baseado na página */
      object-fit: contain;
      display: block;
    }


    figure.ev figcaption {
      margin-top: 6px;
      font-size: 9.5pt;
      color: #444;
      line-height: 1.25;
    }
    figure.ev a {
      color: #444;
      text-decoration: underline;
      font-size: 9.5pt;
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
    <tr><td class="label">Linha:</td><td class="value">${escapeHtml(lineLabel)}</td></tr>
    <tr><td class="label">Veículo:</td><td class="value">${escapeHtml(occurrence.vehicleNumber)}</td></tr>
    <tr><td class="label">Motorista:</td><td class="value">${driversLines}</td></tr>
    <tr><td class="label">Data Relatório:</td><td class="value">${escapeHtml(reportDateLabel)}</td></tr>
    <tr><td class="label">Data da viagem:</td><td class="value">${escapeHtml(tripDateLabel)}</td></tr>
  </table>

  <div class="occurrence">
    <div class="row"><span class="label2">OCORRÊNCIA:</span> ${escapeHtml(occurrenceTitle)}</div>
    <div class="row"><span class="label2">DATA:</span> ${escapeHtml(eventDateLabel)}</div>
    <div class="row"><span class="label2">Horário do evento:</span> ${escapeHtml(eventTimeLabel)}</div>
  </div>

  <hr class="separator" />

  <div class="relato">
    ${relatoHtml || `<span class="muted">Sem texto.</span>`}
  </div>

  <div class="section-title">EVIDÊNCIAS</div>
  ${evidenceHtml}


</body>
</html>`;
}

/**
 * Texto do usuário: sempre escapado.
 * Texto padrão: permite <strong> apenas nas variáveis.
 */
function buildRelatoHtml(args: {
  reportText: string;
  fallbackPrefixo: string;
  fallbackTripDateLabel: string;
}) {
  const userText = (args.reportText ?? "").trim();

  if (userText) {
    return escapeHtml(userText).replace(/\n/g, "<br/>");
  }

  const prefixo = escapeHtml(args.fallbackPrefixo);
  const tripDate = escapeHtml(args.fallbackTripDateLabel);

  const html = `Durante a análise das atividades do veículo de número <strong>${prefixo}</strong> na viagem do dia <strong>${tripDate}</strong>, identificamos o descumprimento operacional/comercial por parte do condutor, realizando uma parada em local fora do esquema operacional.
Esta atitude representou uma clara violação das normas e padrões pré-estabelecidos, gerando atraso na viagem, prejudicando a qualidade do serviço e desconformidades das informações divulgadas no ato da venda dos bilhetes de passagens.`;

  return html.replace(/\n/g, "<br/>");
}

function escapeHtml(s: string) {
  return (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtDateBr(iso: string) {
  // "2026-02-01" -> "01/02/2026"
  const v = (iso ?? "").trim();
  const parts = v.split("-");
  if (parts.length !== 3) return v || "—";
  const [y, m, d] = parts;
  if (!y || !m || !d) return v || "—";
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function fmtDateBrFromDate(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function fmtTimeBr(t: string) {
  // "12:59:00" -> "12h59"
  const v = (t ?? "").trim();
  if (!v) return "—";
  const [hh, mm] = v.split(":");
  if (!hh || !mm) return v;
  return `${hh}h${mm}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template GENERICO (CCO) — fiel ao modelo visual de Atendimento Especial
// ─────────────────────────────────────────────────────────────────────────────

type EvidenceInputGeneric = {
  dataUri: string;
  caption?: string | null;
  linkTexto?: string;
  linkUrl?: string;
};

export function buildGenericOccurrencePdfHtml(args: {
  occurrence: import("./pdf.types.js").PdfOccurrence;
  drivers: import("./pdf.types.js").PdfDriver[];
  evidences: EvidenceInputGeneric[];
  logoDataUri?: string | null;
  footerCompany?: string | null;
  footerCnpj?: string | null;
}) {
  const { occurrence, drivers, evidences, logoDataUri } = args;

  const company = args.footerCompany ?? "KANDANGO TRANSPORTE E TURISMO LTDA";
  const cnpj = args.footerCnpj ?? "03.233.439/0001-52";

  const reportTitle = escapeHtml(occurrence.reportTitle ?? "Relatório");
  const ccoOperator = escapeHtml(occurrence.ccoOperator ?? "—");
  const eventDateLabel = fmtDateBr(occurrence.eventDate);
  const horario = fmtTimeBr(occurrence.startTime);
  const prefixo = escapeHtml(occurrence.vehicleNumber ?? "—");
  const itinerario = escapeHtml(occurrence.lineLabel ?? "—");
  const local = escapeHtml(occurrence.place ?? "—");
  const vehicleKm =
    occurrence.vehicleKm != null ? String(occurrence.vehicleKm) : "—";

  const driver1 = drivers[0];
  const driver2 = drivers[1];

  function driverText(d: typeof driver1 | undefined): string {
    if (!d) return "—";
    const parts: string[] = [];
    if (d.code) parts.push(escapeHtml(d.code));
    parts.push(escapeHtml(d.name));
    if (d.baseCode) parts.push(escapeHtml(d.baseCode));
    return parts.join(" – ");
  }

  const passengerCount =
    occurrence.passengerCount != null ? String(occurrence.passengerCount) : "—";
  const passengerConnection = escapeHtml(occurrence.passengerConnection || "—");

  const relatoHtml = occurrence.relatoHtml || "<p><em>Sem relato registrado.</em></p>";
  const devolutivaHtml = occurrence.devolutivaHtml || "";
  const devolutivaStatus = occurrence.devolutivaStatus ?? null;

  // Badge de status na devolutiva
  const statusBadge =
    devolutivaStatus === "RESOLVIDO"
      ? `<div class="status-badge status-ok">Status: RESOLVIDO</div>`
      : devolutivaStatus === "EM_ANDAMENTO"
        ? `<div class="status-badge status-warn">Status: EM ANDAMENTO</div>`
        : "";

  const logoHtml = logoDataUri
    ? `<img class="logo" src="${logoDataUri}" alt="Logo" />`
    : `<div class="logo-spacer"></div>`;

  // Evidências
  const evidenceHtml =
    evidences.length === 0
      ? `<div class="muted-ev">Sem evidências anexadas.</div>`
      : evidences
          .map((e) => {
            const cap = (e.caption ?? "").trim();
            const linkTexto = (e.linkTexto ?? "").trim();
            let linkUrl = (e.linkUrl ?? "").trim();
            if (linkUrl && !/^https?:\/\//i.test(linkUrl)) {
              linkUrl = "https://" + linkUrl;
            }
            const captionParts: string[] = [];
            if (cap) captionParts.push(escapeHtml(cap));
            if (linkUrl) {
              captionParts.push(
                `<a href="${escapeHtml(linkUrl)}" target="_blank">${escapeHtml(linkTexto || "Acessar evidência")}</a>`,
              );
            }
            const finalCaption =
              captionParts.length > 0
                ? `<figcaption>${captionParts.join("<br/>")}</figcaption>`
                : "";
            return `<figure class="ev"><img src="${e.dataUri}" alt="Evidência" />${finalCaption}</figure>`;
          })
          .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Relatório de Ocorrência — ${reportTitle}</title>

  <style>
    /* ── Página ── */
    @page {
      size: A4;
      margin-top: 15mm;
      margin-right: 14mm;
      margin-left: 14mm;
      margin-bottom: 20mm;
    }

    * { box-sizing: border-box; }

    body {
      font-family: "Segoe UI", Arial, Helvetica, sans-serif;
      font-size: 10.5pt;
      color: #111;
      margin: 0;
      padding: 0;
      background: #fff;
    }

    /* ── Cabeçalho ── */
    .doc-header {
      display: flex;
      align-items: stretch;
      margin-bottom: 12px;
      border: 1px solid #ccc;
    }
    .header-logo-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px 16px;
      background: #fff;
      min-width: 160px;
    }
    .logo { height: 60px; display: block; }
    .logo-spacer { width: 120px; height: 60px; }
    .header-divider {
      width: 1px;
      background: #ccc;
      flex-shrink: 0;
    }
    .header-title-wrap {
      flex: 1;
      background: #E07B1F;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 10px 20px;
    }
    .header-main-title {
      font-family: "Segoe UI", Arial, Helvetica, sans-serif;
      font-size: 15pt;
      font-weight: 700;
      color: #fff;
      letter-spacing: 0.8px;
      line-height: 1.15;
      text-align: center;
      text-transform: uppercase;
    }
    .header-sub-title {
      font-family: "Segoe UI", Arial, Helvetica, sans-serif;
      font-size: 9.5pt;
      font-weight: 400;
      color: #fff;
      margin-top: 4px;
      text-align: center;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    /* ── Bloco de seção ── */
    .section {
      margin-top: 8px;
      border: 1px solid #bbb;
      border-radius: 0;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .section-hd {
      background: #1d1d1d;
      color: #fff;
      padding: 6px 10px;
      font-size: 10pt;
      font-weight: 700;
      letter-spacing: 0.4px;
      line-height: 1.2;
    }

    /* ── Tabela de dados ── */
    table.dt {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5pt;
    }
    table.dt td {
      border: 1px solid #ccc;
      padding: 6px 10px;
      vertical-align: middle;
    }
    table.dt td.lbl {
      font-weight: 700;
      background: #FDF5EE;
      width: 21%;
      white-space: nowrap;
    }
    table.dt td.val {
      background: #fff;
      width: 29%;
    }
    /* última linha da tabela DADOS tem o Tipo em negrito */
    table.dt td.val-bold {
      background: #fff;
      width: 29%;
      font-weight: 700;
    }

    /* ── Área de texto (relato / devolutiva) ── */
    .text-area {
      padding: 10px 12px;
      font-size: 10.5pt;
      line-height: 1.6;
      text-align: justify;
      background: #fff;
    }
    .text-area p  { margin: 0 0 7px 0; }
    .text-area ul { margin: 4px 0 4px 18px; padding: 0; }
    .text-area li { margin-bottom: 3px; }
    .text-area em { font-style: italic; }
    .text-area strong { font-weight: 700; }

    /* ── Status badge na devolutiva ── */
    .status-badge {
      padding: 5px 12px;
      font-size: 10.5pt;
      font-weight: 700;
    }
    .status-warn {
      background: #FFFBEA;
      color: #7a5a00;
      border-bottom: 1px solid #E8D87A;
    }
    .status-ok {
      background: #F0FFF4;
      color: #1a6b3a;
      border-bottom: 1px solid #84d9a4;
    }

    /* ── Evidências ── */
    .ev-section { margin-top: 8px; }
    figure.ev {
      margin: 0 0 10px 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    figure.ev img {
      width: 100%;
      height: auto;
      max-height: 60vh;
      object-fit: contain;
      display: block;
      border: 1px solid #ddd;
    }
    figure.ev figcaption {
      margin-top: 4px;
      font-size: 9pt;
      color: #555;
      line-height: 1.3;
    }
    figure.ev a { color: #555; text-decoration: underline; }
    .muted-ev { color: #888; font-size: 10pt; padding: 6px 0; }

    .content-wrap { padding-bottom: 4px; }
  </style>
</head>
<body>

  <div class="content-wrap">

    <!-- ══ CABEÇALHO ══ -->
    <div class="doc-header">
      <div class="header-logo-wrap">
        ${logoHtml}
      </div>
      <div class="header-divider"></div>
      <div class="header-title-wrap">
        <div class="header-main-title">RELATÓRIO DE OCORRÊNCIA</div>
        <div class="header-sub-title">${reportTitle}</div>
      </div>
    </div>

    <!-- ══ DADOS DA OCORRÊNCIA ══ -->
    <div class="section">
      <div class="section-hd">DADOS DA OCORR&#202;NCIA</div>
      <table class="dt">
        <tr>
          <td class="lbl">Operador CCO:</td>
          <td class="val">${ccoOperator}</td>
          <td class="lbl">Data Origem:</td>
          <td class="val">${escapeHtml(eventDateLabel)}</td>
        </tr>
        <tr>
          <td class="lbl">Horário:</td>
          <td class="val">${escapeHtml(horario)}</td>
          <td class="lbl">Prefixo do Ve&#237;culo:</td>
          <td class="val">${prefixo}</td>
        </tr>
        <tr>
          <td class="lbl">Itiner&#225;rio:</td>
          <td class="val">${itinerario}</td>
          <td class="lbl">Local:</td>
          <td class="val">${local}</td>
        </tr>
        <tr>
          <td class="lbl">KM do Ve&#237;culo:</td>
          <td class="val">${escapeHtml(vehicleKm)}</td>
          <td class="lbl">Tipo de Ocorr&#234;ncia:</td>
          <td class="val-bold">${reportTitle}</td>
        </tr>
      </table>
    </div>

    <!-- ══ TRIPULAÇÃO ══ -->
    <div class="section">
      <div class="section-hd">TRIPULA&#199;&#195;O</div>
      <table class="dt">
        <tr>
          <td class="lbl">Motorista 01:</td>
          <td class="val">${driverText(driver1)}</td>
          <td class="lbl">Motorista 02:</td>
          <td class="val">${driverText(driver2)}</td>
        </tr>
      </table>
    </div>

    <!-- ══ PASSAGEIROS ══ -->
    <div class="section">
      <div class="section-hd">PASSAGEIROS</div>
      <table class="dt">
        <tr>
          <td class="lbl">Qtd. Passageiros:</td>
          <td class="val">${escapeHtml(passengerCount)}</td>
          <td class="lbl" style="white-space:normal;">Passageiros<br/>Conex&#227;o:</td>
          <td class="val">${passengerConnection}</td>
        </tr>
      </table>
    </div>

    <!-- ══ RELATO DA OCORRÊNCIA ══ -->
    <div class="section">
      <div class="section-hd">RELATO DA OCORR&#202;NCIA</div>
      <div class="text-area">${relatoHtml}</div>
    </div>

    ${
      devolutivaHtml || statusBadge
        ? `
    <!-- ══ DEVOLUTIVA / SOLUÇÃO ADOTADA ══ -->
    <div class="section">
      <div class="section-hd">DEVOLUTIVA / SOLU&#199;&#195;O ADOTADA</div>
      ${statusBadge}
      ${devolutivaHtml ? `<div class="text-area">${devolutivaHtml}</div>` : ""}
    </div>`
        : ""
    }

    <!-- ══ EVIDÊNCIAS ══ -->
    ${
      evidences.length > 0
        ? `<div class="ev-section">${evidenceHtml}</div>`
        : ""
    }

  </div><!-- /content-wrap -->

</body>
</html>`;
}
