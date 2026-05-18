import type { Page } from 'playwright'

/** Converte "YYYY-MM-DD" → "DD/MM/YYYY" para comparar com o que o RIZER exibe na tabela */
function toDisplayDate(eventDate: string): string {
  const [y, m, d] = eventDate.split('-')
  return `${d}/${m}/${y}`
}

/**
 * Pesquisa na listagem do RIZER pela matrícula do motorista,
 * varre as linhas e retorna o ID numérico da ocorrência cujo
 * TIPO DE OCORRÊNCIA + DATA batem com os parâmetros.
 */
export async function findRizerOccurrenceId(page: Page, params: {
  matricula: string
  tipoOcorrencia: string  // ex: "PARADA IRREGULAR"
  eventDate: string       // YYYY-MM-DD
}): Promise<string> {
  const { matricula, tipoOcorrencia, eventDate } = params
  const baseUrl = new URL(process.env['RIZER_DISCIPLINARY_URL']!).origin
  const displayDate = toDisplayDate(eventDate)

  await page.goto(`${baseUrl}/ocorrencias_disciplinares`)
  await page.waitForLoadState('networkidle')

  // Campo de busca da DataTable (sem gatilho, usa Enter)
  const searchInput = page.locator('input[type="search"][aria-controls="datatable-no-buttons"]')
  await searchInput.waitFor({ state: 'visible', timeout: 10000 })
  await searchInput.fill(matricula)
  await searchInput.press('Enter')
  await page.waitForTimeout(1500)

  const rows = page.locator('#datatable-no-buttons tbody tr')
  const count = await rows.count()

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i)
    const text = (await row.innerText()).toUpperCase()

    const tipoMatch = text.includes(tipoOcorrencia.toUpperCase())
    const dateMatch = text.includes(displayDate)

    if (tipoMatch && dateMatch) {
      const editHref = await row
        .locator('a[href*="/ocorrencias_disciplinares/"][href*="/edit"]')
        .getAttribute('href')

      const match = editHref?.match(/\/ocorrencias_disciplinares\/(\d+)\/edit/)
      if (match?.[1]) return match[1]
    }
  }

  throw new Error(
    `Ocorrência não encontrada no RIZER: matrícula ${matricula}, tipo "${tipoOcorrencia}", data ${displayDate}`
  )
}
