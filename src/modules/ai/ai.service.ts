import Groq from "groq-sdk";

function getClient() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY não configurada no .env");
  return new Groq({ apiKey: key });
}

// ── LanguageTool: detecta erros ortográficos/gramaticais ─────────────────────
type LTMatch = { message: string; offset: number; length: number; replacements: { value: string }[] };

export async function checkWithLanguageTool(plainText: string): Promise<LTMatch[]> {
  const body = new URLSearchParams({ text: plainText, language: "pt-BR" });
  const res = await fetch("https://api.languagetool.org/v2/check", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) return []; // falha silenciosa — continua sem contexto
  const json: any = await res.json();
  return (json.matches ?? []) as LTMatch[];
}

// ── Groq: corrige o HTML usando os erros do LanguageTool como guia ───────────
export async function correctOccurrenceText(html: string, plainText: string): Promise<{ corrected: string; errorCount: number }> {
  const groq = getClient();

  // 1. Detecta erros com LanguageTool
  const matches = await checkWithLanguageTool(plainText);
  const errorCount = matches.length;

  // 2. Monta contexto com os erros encontrados (até 20 para não estourar tokens)
  const errorsContext = matches.slice(0, 20).map((m, i) => {
    const wrong = plainText.substring(m.offset, m.offset + m.length);
    const suggestion = m.replacements[0]?.value ?? "—";
    return `${i + 1}. "${wrong}" → "${suggestion}" (${m.message})`;
  }).join("\n");

  const errorBlock = errorCount > 0
    ? `\n\nErros detectados pelo verificador ortográfico:\n${errorsContext}`
    : "\n\nNenhum erro ortográfico detectado — retorne o texto exatamente como está.";

  // 3. Groq corrige o HTML com base nos erros identificados
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: "Você é um revisor ortográfico de textos operacionais em português brasileiro. Corrija SOMENTE os erros listados. Nunca reescreva frases, nunca mude o significado, nunca adicione nem remova conteúdo.",
      },
      {
        role: "user",
        content: `Corrija APENAS os erros listados abaixo no texto HTML. Mantenha todas as tags HTML intactas. Retorne SOMENTE o HTML corrigido, sem explicações, sem markdown.${errorBlock}

HTML:
${html}`,
      },
    ],
    temperature: 0.05,
    max_tokens: 1024,
  });

  const corrected = completion.choices[0]?.message?.content?.trim();
  if (!corrected) throw new Error("A IA não retornou o texto corrigido.");
  return { corrected, errorCount };
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|tr|li|div|h[1-6]|thead|tbody)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function summarizeAnaliseOp(
  html: string,
  reportTitle: string,
  mode: "whatsapp" | "email",
): Promise<string> {
  const groq = getClient();
  const plain = stripHtml(html).slice(0, 6000);

  const systemPrompt =
    "Você é um assistente especializado em análise operacional de transporte rodoviário de longa distância. " +
    "Responda sempre em português formal e direto. Nunca invente dados que não estão no texto.";

  const userPrompt =
    mode === "whatsapp"
      ? `Analise o relatório de viagem abaixo e gere uma mensagem formatada para WhatsApp.
Use exatamente este layout (substitua os colchetes pelos dados reais; omita linhas sem dados):

🔍 *ANÁLISE DE VIAGEM*

📋 *Linha:* [linha e horário]
🚌 *Prefixo:* [prefixo do veículo]
📅 *Data:* [data da viagem]
👤 *Motorista:* [matrícula – nome – base]

📊 *Achados:*
[liste cada irregularidade com •, máximo 5 itens]

[frase final de conclusão em 1 linha]

Relatório:
${plain}`
      : `Analise o relatório de viagem abaixo e escreva um resumo executivo formal para e-mail interno.
Estrutura esperada:
1. Parágrafo de identificação (linha, prefixo, data, motorista)
2. Parágrafo com as irregularidades encontradas (paradas fora do esquema, excessos de tempo, pontos não visitados)
3. Parágrafo de conclusão

Máximo 4 parágrafos curtos. Linguagem formal. Sem marcações markdown.

Relatório:
${plain}`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt },
    ],
    temperature: 0.25,
    max_tokens: mode === "whatsapp" ? 400 : 600,
  });

  const result = completion.choices[0]?.message?.content?.trim();
  if (!result) throw new Error("A IA não retornou resultado.");
  return result;
}

export async function gerarParagrafoSuspensao(args: {
  tipoOcorrencia: string;
  prefixo: string;
  linha: string;
  local: string;
  dataOcorrencia: string;
  motoristaNome: string;
}): Promise<string> {
  const groq = getClient();
  const { tipoOcorrencia, prefixo, linha, local, dataOcorrencia, motoristaNome } = args;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "Você é um redator de documentos disciplinares de RH de uma empresa de transporte rodoviário. " +
          "Escreva em português formal e objetivo. Nunca invente dados não fornecidos.",
      },
      {
        role: "user",
        content:
          `Escreva APENAS UMA frase inicial para o parágrafo principal de uma carta de suspensão disciplinar. ` +
          `A frase deve relatar objetivamente a infração cometida pelo motorista, mencionando os dados fornecidos.\n` +
          `Dados:\n` +
          `- Tipo de ocorrência: ${tipoOcorrencia}\n` +
          `- Veículo (prefixo): ${prefixo}\n` +
          `- Linha: ${linha || "não informada"}\n` +
          `- Local/Ponto: ${local || "não informado"}\n` +
          `- Data da ocorrência: ${dataOcorrencia}\n` +
          `- Motorista: ${motoristaNome}\n\n` +
          `Escreva apenas a frase, sem introdução, sem explicações adicionais. Termine com ponto final.`,
      },
    ],
    temperature: 0.2,
    max_tokens: 200,
  });

  const result = completion.choices[0]?.message?.content?.trim();
  if (!result) throw new Error("A IA não retornou o parágrafo.");
  return result;
}

export async function summarizeOccurrenceText(
  text: string,
  title?: string,
): Promise<string> {
  const groq = getClient();

  const tituloInfo = title?.trim() ? `Título da ocorrência: ${title}\n` : "";

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "Você é um assistente especializado em relatórios operacionais de transporte rodoviário. Responda sempre em português, de forma direta e formal.",
      },
      {
        role: "user",
        content: `${tituloInfo}Relato da ocorrência:\n${text}\n\nGere um resumo executivo objetivo em até 3 frases, destacando: o que aconteceu, impacto e a resolução adotada (se houver). Responda apenas com o resumo, sem introduções ou explicações adicionais.`,
      },
    ],
    temperature: 0.3,
    max_tokens: 300,
  });

  const result = completion.choices[0]?.message?.content?.trim();
  if (!result) throw new Error("A IA não retornou um resumo.");
  return result;
}
