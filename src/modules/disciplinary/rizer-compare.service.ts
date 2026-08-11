// src/modules/disciplinary/rizer-compare.service.ts
import { createContextWithSession } from '../automation/playwright/browser.js'
import { login, isOnLoginPage } from '../automation/playwright/login.js'
import { listRizerOccurrenceCountsForDriver, type RizerTipoCount } from '../automation/playwright/listOccurrencesInRizer.js'
import { takeErrorScreenshot } from '../automation/playwright/helpers.js'
import { getDriverById } from '../drivers/drivers.repo.js'
import { getDriverOccurrenceHistory } from './disciplinary.service.js'

/**
 * Compara, POR TIPO, a contagem de ocorrências do motorista no nosso banco
 * (últimos 90 dias, mesma janela do perfil) contra a listagem do RIZER
 * filtrada pela matrícula. Não é auditoria ocorrência-a-ocorrência — ver
 * aviso em listOccurrencesInRizer.ts sobre a data de cadastro vs. evento.
 */
export async function compareDriverWithRizer(driverId: string) {
  const driver = await getDriverById(driverId)
  if (!driver) throw new Error('Motorista não encontrado.')

  const history = await getDriverOccurrenceHistory(driverId, 200)

  const nossoPorTipo = new Map<string, number>()
  // Nomes reais (occurrence_name, vindo dos presets sourced do RIZER) vistos
  // pra cada tipo — pra tipos "guarda-chuva" como "Genérico", o título é
  // genérico demais pra buscar no RIZER (risco de falso-positivo pegando
  // qualquer linha com a palavra "genérico"); o nome específico da ocorrência
  // é o sinal real de o que procurar lá.
  const nomesRealPorTipo = new Map<string, Set<string>>()
  const comNomePorTipo = new Map<string, number>()
  for (const h of history) {
    const tipo = h.typeTitle ?? h.typeCode ?? 'Outro'
    nossoPorTipo.set(tipo, (nossoPorTipo.get(tipo) ?? 0) + 1)

    if (h.occurrenceName) {
      const set = nomesRealPorTipo.get(tipo) ?? new Set<string>()
      set.add(h.occurrenceName)
      nomesRealPorTipo.set(tipo, set)
      comNomePorTipo.set(tipo, (comNomePorTipo.get(tipo) ?? 0) + 1)
    }
  }

  const tipos = Array.from(nossoPorTipo.keys())

  // Override só entra pros tipos onde TODAS as ocorrências têm nome
  // específico registrado — se só parte tiver, misturar "nome específico"
  // com "título genérico" na mesma busca esconderia as sem nome.
  const tipoAliasesOverride: Record<string, string[]> = {}
  for (const tipo of tipos) {
    const nomes = nomesRealPorTipo.get(tipo)
    if (nomes && comNomePorTipo.get(tipo) === nossoPorTipo.get(tipo)) {
      tipoAliasesOverride[tipo] = Array.from(nomes)
    }
  }

  const { browser, context } = await createContextWithSession()
  const page = await context.newPage()

  let rizerResult: { termUsed: string | null; totalRows: number; porTipo: Record<string, RizerTipoCount> }
  try {
    await page.goto(process.env['RIZER_DISCIPLINARY_URL']!)
    await page.waitForLoadState('domcontentloaded')

    if (isOnLoginPage(page)) {
      console.log('[rizer-compare] Sessão inválida — fazendo login...')
      await login(page, context)
    }

    rizerResult = await listRizerOccurrenceCountsForDriver(page, {
      matricula: driver.code,
      motoristaNome: driver.name,
      tipos,
      tipoAliasesOverride,
    })
  } catch (err) {
    await takeErrorScreenshot(page, 'rizer_compare').catch(() => {})
    throw err
  } finally {
    await browser.close()
  }

  const porTipo = tipos.map((tipo) => ({
    tipo,
    nosso: nossoPorTipo.get(tipo) ?? 0,
    rizer: rizerResult.porTipo[tipo]?.total ?? 0,
    // Só vem preenchido pros tipos com variantes conhecidas no RIZER (ver
    // TIPO_RIZER_ALIASES em listOccurrencesInRizer.ts) — dá pra UI explicar
    // de onde veio a soma em vez de mostrar um número opaco.
    subtipos: rizerResult.porTipo[tipo]?.subtipos ?? undefined,
  }))

  return {
    matriculaUsada: rizerResult.termUsed,
    totalRizer: rizerResult.totalRows,
    totalNosso: history.length,
    porTipo,
  }
}
