const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const EXTENSO: Record<number, string> = {
  1: "um", 2: "dois", 3: "três", 4: "quatro", 5: "cinco",
  6: "seis", 7: "sete", 8: "oito", 9: "nove", 10: "dez",
};

function fmtDateBr(iso: string): string {
  const [y, m, d] = (iso ?? "").split("-");
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function fmtDateExtenso(iso: string): string {
  const [y, m, d] = (iso ?? "").split("-");
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
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function esc(s: string): string {
  return (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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

  const dataRetorno = addDays(dataInicioSuspensao, quantidadeDias);
  const nDias = quantidadeDias;
  const nDiasExtenso = EXTENSO[nDias] ?? String(nDias);
  const diaPalavra = nDias === 1 ? "dia" : "dias";

  const logoHtml = logoDataUri
    ? `<img class="suspensao-logo" src="${logoDataUri}" alt="Logo" />`
    : "";

  const hoje = new Date();
  const dataAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Suspen&#231;&#227;o Disciplinar</title>
  <style>
    @page {
      size: A4;
      margin: 25mm 25mm 25mm 25mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 12pt;
      color: #000;
      margin: 0;
      padding: 0;
      background: #fff;
    }
    .suspensao-logo {
      width: 262px;
      height: auto;
      display: block;
      margin-bottom: 18pt;
    }
    .title {
      text-align: center;
      font-weight: bold;
      font-size: 12pt;
      margin: 0 0 18pt 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .field {
      margin: 0 0 4pt 0;
      font-size: 12pt;
      line-height: 1.4;
    }
    .field.bold { font-weight: bold; }
    .spacer { margin-bottom: 14pt; }
    .para {
      font-size: 12pt;
      font-weight: bold;
      line-height: 1.5;
      text-align: justify;
      margin: 0 0 14pt 0;
    }
    .assinatura {
      margin-top: 40pt;
      text-align: center;
      font-size: 11pt;
      font-weight: normal;
      line-height: 1.6;
    }
    .assinatura .cidade-data {
      text-align: right;
      margin-bottom: 30pt;
    }
    .assinatura .linha {
      display: inline-block;
      border-top: 1px solid #000;
      width: 260px;
      margin-bottom: 4pt;
    }
  </style>
</head>
<body>

  ${logoHtml}

  <div class="title">SUSPENS&#195;O DISCIPLINAR</div>

  <div class="field">Colaborador: ${esc(colaborador)}</div>
  <div class="field bold">Fun&#231;&#227;o: Motorista rodovi&#225;rio</div>
  <div class="field bold">Data: ${esc(fmtDateBr(dataOcorrencia))}</div>
  <div class="field bold">Assunto: ${esc(assunto)}</div>
  <div class="field bold">Data de in&#237;cio da suspens&#227;o: ${esc(fmtDateBr(dataInicioSuspensao))}</div>
  <div class="field bold">Dura&#231;&#227;o: ${nDias} ${diaPalavra}</div>

  <div class="spacer"></div>

  <div class="para">${esc(primeiroParagrafo)} Tal conduta configura falta grave, nos termos do Art. 482 da Consolida&#231;&#227;o das Leis do Trabalho &#8211; CLT, e do regulamento interno da empresa, sendo pass&#237;vel de puni&#231;&#227;o disciplinar.</div>

  <div class="para">Diante do exposto, com fundamento no Art. 474 da CLT, notificamos V.S&#170; que ficar&#225; suspenso(a) pelo per&#237;odo de ${nDias} (${esc(nDiasExtenso)}) ${diaPalavra}, a contar de ${esc(fmtDateBr(dataInicioSuspensao))}, devendo retornar ao trabalho no dia ${esc(fmtDateBr(dataRetorno))}. Essa medida disciplinar visa conscientizar o colaborador sobre a gravidade de seus atos e evitar reincid&#234;ncias, que poder&#227;o resultar em penalidades mais severas, inclusive rescis&#227;o por justa causa.</div>

  <div class="assinatura">
    <div class="cidade-data">Bras&#237;lia-DF, ${esc(fmtDateExtenso(dataAtual))}</div>
    <div><span class="linha"></span></div>
    <div>Ger&#234;ncia / Fiscaliza&#231;&#227;o</div>
    <br/>
    <div><span class="linha"></span></div>
    <div>Ci&#234;ncia do Colaborador</div>
  </div>

</body>
</html>`;
}
