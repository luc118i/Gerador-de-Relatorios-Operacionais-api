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

  // Horário do evento (sem segundos) -> 12h59 à 13h47
  const eventTimeLabel =
    occurrence.startTime && occurrence.endTime
      ? `${fmtTimeBr(occurrence.startTime)} à ${fmtTimeBr(occurrence.endTime)}`
      : occurrence.startTime
        ? fmtTimeBr(occurrence.startTime)
        : "—";

  // ✅ Agora já suporta typeTitle/typeCode vindo do repo
  const occurrenceTitle =
    occurrence.typeTitle ?? occurrence.typeCode ?? occurrence.typeId;

  // RELATO:
  // - se vier reportText do usuário: escapa (seguro)
  // - se não vier: usa default com <strong> nas variáveis (bonito)
  const relatoHtml = buildRelatoHtml({
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
