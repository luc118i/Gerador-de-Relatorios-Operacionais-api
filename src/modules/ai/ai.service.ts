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
