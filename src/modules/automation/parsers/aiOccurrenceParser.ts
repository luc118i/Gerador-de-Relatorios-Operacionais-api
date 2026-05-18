import Groq from 'groq-sdk'
import type { AIExtractedData } from '../types/automation.types.js'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SYSTEM_PROMPT = `
Você é um extrator de dados operacionais. Extraia do relato fornecido:
- nome completo do motorista
- matrícula do motorista (número de registro interno, se presente)
- prefixo do veículo
- data e hora da ocorrência
- base operacional

IMPORTANTE:
O nome do motorista pode aparecer em qualquer posição do texto.
Retorne APENAS um JSON válido, sem markdown, sem explicações.

Formato obrigatório:
{
  "motorista_nome": "",
  "matricula": "",
  "prefixo": "",
  "base_operacional": "",
  "data_ocorrencia": ""
}

data_ocorrencia deve estar no formato ISO 8601: "YYYY-MM-DDTHH:mm:ss"
base_operacional deve estar em letras maiúsculas.
matricula deve ser apenas o número, ou string vazia se não encontrado.
`

export async function parseOccurrenceWithAI(texto: string): Promise<AIExtractedData> {
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: texto },
    ],
    temperature: 0,
    max_tokens: 500,
  })

  const raw = response.choices[0]?.message?.content ?? ''

  try {
    return JSON.parse(raw) as AIExtractedData
  } catch {
    throw new Error(`Falha ao parsear resposta da IA: ${raw}`)
  }
}
