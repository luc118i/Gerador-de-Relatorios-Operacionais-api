import type { Page } from 'playwright'
import { ids } from './selectors.js'
import { takeErrorScreenshot } from './helpers.js'

/**
 * Abre a página de edição da ocorrência no RIZER e preenche o campo
 * "Link da Medida", depois salva o formulário.
 */
export async function fillMedidaOnEdit(page: Page, rizerId: string, linkMedida: string): Promise<void> {
  const baseUrl = new URL(process.env['RIZER_DISCIPLINARY_URL']!).origin

  await page.goto(`${baseUrl}/ocorrencias_disciplinares/${rizerId}/edit`)
  await page.waitForLoadState('networkidle')

  try {
    const field = page.locator(`#${ids.linkMedida}`)
    await field.waitFor({ state: 'visible', timeout: 10000 })
    await field.clear()
    await field.fill(linkMedida)
    await page.waitForTimeout(300)

    const saveBtn = page.getByRole('button', { name: /Salvar|Atualizar/i }).last()
    await saveBtn.scrollIntoViewIfNeeded()
    await saveBtn.click()
    await page.waitForLoadState('networkidle', { timeout: 20000 })
  } catch (err) {
    await takeErrorScreenshot(page, 'edit_medida')
    throw err
  }
}
