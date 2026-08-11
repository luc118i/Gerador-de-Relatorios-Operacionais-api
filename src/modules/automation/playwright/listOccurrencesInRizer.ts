import type { Page } from 'playwright'

/**
 * Alguns dos nossos `occurrence_types.title` são mais genéricos que os
 * nomes usados no RIZER — nesses casos o match por substring simples
 * (`text.includes(tipo)`) já agrega várias linhas do RIZER num só balde
 * nosso (ex.: "Excesso de Velocidade" bate nas 3 faixas do RIZER), mas sem
 * visibilidade de QUAIS variantes compuseram o total — o que faz a coluna
 * "Diferença" da tela parecer bug quando na verdade é soma esperada.
 *
 * Também cobre o caso oposto: títulos nossos que não têm nenhuma
 * correspondência por substring com o nome usado no RIZER hoje, e por isso
 * sempre dariam falso-zero (ex.: nosso "DESCUMPRIMENTO OPERACIONAL / PARADA
 * FORA DO PROGRAMADO" vs. o "DESCUMPRIMENTO ESQUEMA OPERACIONAL" do RIZER).
 *
 * Quando um tipo nosso está aqui, a busca passa a usar as variantes listadas
 * em vez do título literal. Tipos fora do mapa continuam usando o título
 * como substring, igual antes.
 */
const TIPO_RIZER_ALIASES: Record<string, string[]> = {
  'Excesso de Velocidade': [
    'EXCESSO DE VELOCIDADE ( >=90 <=99)',
    'EXCESSO DE VELOCIDADE (>=100 <=105)',
    'EXCESSO DE VELOCIDADE (>105)',
  ],
  'DESCUMPRIMENTO OPERACIONAL / PARADA FORA DO PROGRAMADO': [
    'DESCUMPRIMENTO ESQUEMA OPERACIONAL',
  ],
}

export interface RizerTipoCount {
  total: number
  // Só populado quando o tipo tem mais de uma variante em TIPO_RIZER_ALIASES
  // — dá pra UI mostrar de onde veio a soma, em vez de um número opaco.
  subtipos?: Array<{ label: string; count: number }>
}

/**
 * Pesquisa na listagem do RIZER pela matrícula do motorista e conta quantas
 * linhas batem com cada tipo de ocorrência informado — mesma técnica de
 * substring match de findRizerOccurrenceId.ts (procura o texto do tipo em
 * qualquer lugar da linha), só que aplicada pra TODOS os tipos de uma vez,
 * em vez de parar no primeiro match. Tipos com variantes conhecidas do
 * RIZER (ver TIPO_RIZER_ALIASES, ou `tipoAliasesOverride` do chamador) usam
 * as variantes na busca, não o título.
 *
 * ⚠️ Não é match ocorrência-a-ocorrência: a listagem do RIZER mostra a data
 * de CADASTRO, não a data do evento, então não dá pra casar linha com
 * ocorrência individual com segurança. Isso conta linhas por tipo, é uma
 * comparação de volume, não uma auditoria 1:1.
 */
export async function listRizerOccurrenceCountsForDriver(page: Page, params: {
  matricula: string
  motoristaNome?: string
  tipos: string[] // tipos a procurar (ex.: nomes vindos do nosso banco)
  // Aliases descobertos a partir dos occurrence_name reais do motorista
  // (ver rizer-compare.service.ts). Tem prioridade sobre TIPO_RIZER_ALIASES
  // — quando o chamador já sabe os nomes específicos usados no RIZER pra
  // esse motorista, é melhor sinal que qualquer mapa estático.
  tipoAliasesOverride?: Record<string, string[]>
}): Promise<{ termUsed: string | null; totalRows: number; porTipo: Record<string, RizerTipoCount> }> {
  const { matricula, motoristaNome, tipos, tipoAliasesOverride } = params
  const baseUrl = new URL(process.env['RIZER_DISCIPLINARY_URL']!).origin

  const searchTerms: string[] = []
  if (matricula) searchTerms.push(matricula)
  if (motoristaNome) searchTerms.push(motoristaNome.split(' ')[0]!)

  const porTipo: Record<string, RizerTipoCount> = {}
  for (const tipo of tipos) porTipo[tipo] = { total: 0 }

  for (const term of searchTerms) {
    await page.goto(`${baseUrl}/ocorrencias_disciplinares`)
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[type="search"][aria-controls="datatable-no-buttons"]')
    await searchInput.waitFor({ state: 'visible', timeout: 10000 })
    await searchInput.fill(term)
    await searchInput.press('Enter')
    await page.waitForTimeout(1500)

    const rows = page.locator('#datatable-no-buttons tbody tr')
    const count = await rows.count()

    // DataTable mostra "Nenhum registro encontrado" como única linha quando vazio.
    const rowTexts: string[] = []
    for (let i = 0; i < count; i++) {
      const text = (await rows.nth(i).innerText()).toUpperCase()
      if (text.includes('NENHUM REGISTRO')) continue
      rowTexts.push(text)
    }

    if (rowTexts.length === 0) {
      console.log(`[listRizer] Nenhum resultado para "${term}", tentando próximo termo...`)
      continue
    }

    for (const text of rowTexts) {
      for (const tipo of tipos) {
        const aliases = tipoAliasesOverride?.[tipo] ?? TIPO_RIZER_ALIASES[tipo]

        if (!aliases) {
          if (text.includes(tipo.toUpperCase())) {
            porTipo[tipo]!.total += 1
          }
          continue
        }

        // Cada linha conta pra no máximo uma variante — evita contar a
        // mesma linha 2x se, por algum acaso, o texto batesse com mais de
        // um alias ao mesmo tempo.
        const matchedAlias = aliases.find((alias) => text.includes(alias.toUpperCase()))
        if (!matchedAlias) continue

        porTipo[tipo]!.total += 1
        porTipo[tipo]!.subtipos ??= aliases.map((label) => ({ label, count: 0 }))
        const bucket = porTipo[tipo]!.subtipos!.find((s) => s.label === matchedAlias)
        if (bucket) bucket.count += 1
      }
    }

    return { termUsed: term, totalRows: rowTexts.length, porTipo }
  }

  return { termUsed: null, totalRows: 0, porTipo }
}
