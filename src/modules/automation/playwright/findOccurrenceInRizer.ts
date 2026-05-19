import type { Page } from 'playwright'

/**
 * Pesquisa na listagem do RIZER pela matrícula do motorista,
 * varre as linhas e retorna o ID numérico da ocorrência mais recente
 * cujo TIPO DE OCORRÊNCIA bate com o parâmetro.
 * A data não é usada como filtro pois o RIZER exibe a data de cadastro,
 * não a data do evento.
 */
export async function findRizerOccurrenceId(page: Page, params: {
  matricula: string
  tipoOcorrencia: string
  motoristaNome?: string  // fallback quando matrícula não retorna resultado
  eventDate?: string
}): Promise<string> {
  const { matricula, tipoOcorrencia, motoristaNome } = params
  const baseUrl = new URL(process.env['RIZER_DISCIPLINARY_URL']!).origin

  // Termos de busca a tentar em ordem
  const searchTerms: string[] = []
  if (matricula) searchTerms.push(matricula)
  if (motoristaNome) searchTerms.push(motoristaNome.split(' ')[0]!) // primeiro nome

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

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i)
      const text = (await row.innerText()).toUpperCase()

      if (text.includes(tipoOcorrencia.toUpperCase())) {
        const editHref = await row
          .locator('a[href*="/ocorrencias_disciplinares/"][href*="/edit"]')
          .getAttribute('href')

        const match = editHref?.match(/\/ocorrencias_disciplinares\/(\d+)\/edit/)
        if (match?.[1]) {
          console.log(`[findRizer] Encontrado via termo "${term}": ID ${match[1]}`)
          return match[1]
        }
      }
    }

    console.log(`[findRizer] Nenhum resultado para "${term}", tentando próximo termo...`)
  }

  throw new Error(
    `Ocorrência não encontrada no RIZER: matrícula "${matricula}", tipo "${tipoOcorrencia}"`
  )
}
