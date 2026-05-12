const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const EXTENSO: Record<number, string> = {
  1: "um", 2: "dois", 3: "três", 4: "quatro", 5: "cinco",
  6: "seis", 7: "sete", 8: "oito", 9: "nove", 10: "dez",
};

function fmtDateBr(iso: string): string {
  const p = (iso ?? "").split("-");
  const y = p[0] ?? ""; const m = p[1] ?? ""; const d = p[2] ?? "";
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function fmtDateExtenso(iso: string): string {
  const p = (iso ?? "").split("-");
  const y = p[0] ?? ""; const m = p[1] ?? ""; const d = p[2] ?? "";
  if (!y || !m || !d) return iso;
  const mes = MESES[parseInt(m, 10) - 1] ?? m;
  return `${parseInt(d, 10)} de ${mes} de ${y}`;
}

function addDays(iso: string, days: number): string {
  const parts = iso.split("-").map(Number);
  const y = parts[0] ?? 2000;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function esc(s: string): string {
  return (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function b(s: string): string {
  return `<strong>${esc(s)}</strong>`;
}

export function buildSuspensaoPdfHtml(args: {
  colaborador: string;
  dataOcorrencia: string;
  assunto: string;
  dataInicioSuspensao: string;
  quantidadeDias: number;
  primeiroParagrafo: string;
  logoDataUri?: string | null;
}): string {
  const {
    colaborador,
    dataOcorrencia,
    assunto,
    dataInicioSuspensao,
    quantidadeDias,
    primeiroParagrafo,
    logoDataUri,
  } = args;

  const dataRetorno    = addDays(dataInicioSuspensao, quantidadeDias);
  const nDias          = quantidadeDias;
  const nDiasExtenso   = EXTENSO[nDias] ?? String(nDias);
  const diaPalavra     = nDias === 1 ? "dia" : "dias";
  const hoje           = new Date();
  const dataAtual      = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

  const logoHtml = logoDataUri
    ? `<img class="logo" src="${logoDataUri}" alt="Logo" />`
    : `<div style="height:43px"></div>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Suspen&#231;&#227;o Disciplinar</title>
  <style>
    /* Puppeteer controla as margens via page.pdf(); @page só declara o tamanho. */
    @page { size: A4; }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: "Calibri Light", "Calibri", "Carlito", Arial, sans-serif;
      font-weight: 300;
      font-size: 12pt;
      color: #000;
      background: #fff;
      line-height: 1.45;
    }

    /* ── Logo ── */
    .logo {
      display: block;
      width: 262px;
      height: auto;
      margin-bottom: 18pt;
    }

    /* ── Título ── */
    .titulo {
      font-family: "Calibri", "Carlito", Arial, sans-serif;
      font-weight: 700;
      font-size: 12pt;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 18pt;
    }

    /* ── Campos de identificação ── */
    .campos { margin-bottom: 18pt; }
    .campo  { font-size: 12pt; line-height: 1.5; }

    /* Valores em destaque: datas, prefixo, assunto, nome */
    .campo strong {
      font-family: "Calibri", "Carlito", Arial, sans-serif;
      font-weight: 700;
    }

    /* ── Parágrafos do corpo ── */
    .para {
      font-size: 12pt;
      line-height: 1.6;
      text-align: justify;
      margin-bottom: 12pt;
    }

    /* Datas / números em destaque dentro dos parágrafos */
    .para strong {
      font-family: "Calibri", "Carlito", Arial, sans-serif;
      font-weight: 700;
    }

    /* Trecho legal em itálico */
    .para em {
      font-style: italic;
      font-weight: 300;
    }

    /* ── Rodapé / Assinaturas ── */
    .footer-area {
      margin-top: 32pt;
      font-family: "Calibri Light", "Calibri", "Carlito", Arial, sans-serif;
      font-weight: 300;
      font-size: 11pt;
    }
    .cidade-data {
      text-align: right;
      margin-bottom: 28pt;
    }
    .assinaturas {
      display: flex;
      justify-content: space-between;
      gap: 24pt;
    }
    .assinatura-col { flex: 1; text-align: center; }
    .assinatura-linha {
      display: block;
      border-top: 1px solid #000;
      margin-bottom: 4pt;
    }
  </style>
</head>
<body>

  ${logoHtml}

  <div class="titulo">SUSPENS&#195;O DISCIPLINAR</div>

  <div class="campos">
    <div class="campo">Colaborador: ${b(colaborador)}</div>
    <div class="campo">Fun&#231;&#227;o: Motorista rodovi&#225;rio</div>
    <div class="campo">Data: ${b(fmtDateBr(dataOcorrencia))}</div>
    <div class="campo">Assunto: ${b(esc(assunto))}</div>
    <div class="campo">Data de in&#237;cio da suspens&#227;o: ${b(fmtDateBr(dataInicioSuspensao))}</div>
    <div class="campo">Dura&#231;&#227;o: ${b(`${nDias} ${diaPalavra}`)}</div>
  </div>

  <div class="para">
    ${esc(primeiroParagrafo)}
    <em> Tal conduta configura falta grave, nos termos do Art.&nbsp;482 da Consolida&#231;&#227;o das Leis do Trabalho &#8211; CLT, e do regulamento interno da empresa, sendo pass&#237;vel de puni&#231;&#227;o disciplinar.</em>
  </div>

  <div class="para">
    Diante do exposto, com fundamento no Art.&nbsp;474 da CLT, notificamos V.S&#170; que ficar&#225; suspenso(a)
    pelo per&#237;odo de <strong>${nDias} (${esc(nDiasExtenso)}) ${diaPalavra}</strong>,
    a contar de <strong>${esc(fmtDateBr(dataInicioSuspensao))}</strong>,
    devendo retornar ao trabalho no dia <strong>${esc(fmtDateBr(dataRetorno))}</strong>.
    Essa medida disciplinar visa conscientizar o colaborador sobre a gravidade de seus atos
    e evitar reincid&#234;ncias, que poder&#227;o resultar em penalidades mais severas, inclusive
    rescis&#227;o por justa causa.
  </div>

  <div class="footer-area">
    <div class="cidade-data">Bras&#237;lia-DF, ${esc(fmtDateExtenso(dataAtual))}.</div>
    <div class="assinaturas">
      <div class="assinatura-col">
        <span class="assinatura-linha"></span>
        Ger&#234;ncia / Fiscaliza&#231;&#227;o
      </div>
      <div class="assinatura-col">
        <span class="assinatura-linha"></span>
        Ci&#234;ncia do Colaborador
      </div>
    </div>
  </div>

</body>
</html>`;
}
