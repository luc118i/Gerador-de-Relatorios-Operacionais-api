import type { Page } from 'playwright'
import { ids } from './selectors.js'
import type { OccurrenceData } from '../types/automation.types.js'
import { takeErrorScreenshot } from './helpers.js'
import { registerMotorista } from './motorista.js'

class MotoristaNotFoundError extends Error {
  constructor(msg: string) { super(msg); this.name = 'MotoristaNotFoundError' }
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Para <select> com Bootstrap Select: usa selectOption force:true na nativa oculta
// depois dispara selectpicker('refresh') para atualizar o visual
async function selectBsOption(page: Page, id: string, value: string): Promise<void> {
  const sel = `#${id}`

  // Tenta match exato de label
  try {
    await page.selectOption(sel, { label: value }, { force: true, timeout: 5000 })
    await refreshPicker(page, sel)
    return
  } catch { /* tenta parcial */ }

  // Fallback: primeiro option cujo texto contenha o valor
  const ok = await page.evaluate(({ sel, val }) => {
    const el = document.querySelector(sel) as HTMLSelectElement | null
    if (!el) return false
    const needle = val.toLowerCase()
    for (const opt of Array.from(el.options)) {
      if (opt.text.toLowerCase().includes(needle)) {
        el.value = opt.value
        el.dispatchEvent(new Event('change', { bubbles: true }))
        if ((window as any).$) (window as any).$(el).selectpicker('refresh')
        return true
      }
    }
    return false
  }, { sel, val: value })

  if (!ok) throw new Error(`Opção "${value}" não encontrada em #${id}`)
}

async function refreshPicker(page: Page, sel: string): Promise<void> {
  await page.evaluate((s) => {
    const el = document.querySelector(s)
    if (el && (window as any).$) (window as any).$(el).selectpicker('refresh')
  }, sel)
}

// Para Bootstrap Select com live-search (como motorista):
// abre o dropdown visível, digita no campo de busca e clica na primeira opção
async function selectBsLiveSearch(page: Page, id: string, searchText: string): Promise<void> {
  // Tenta primeiro via selectOption force (se as opções já estiverem no DOM)
  const sel = `#${id}`
  const hasOptions = await page.evaluate((s) => {
    const el = document.querySelector(s) as HTMLSelectElement | null
    return el ? el.options.length > 1 : false
  }, sel)

  if (hasOptions) {
    try {
      await selectBsOption(page, id, searchText)
      return
    } catch { /* cai no live search */ }
  }

  // Abre o dropdown clicando no botão trigger do Bootstrap Select
  const triggerBtn = page.locator(`button.dropdown-toggle[data-id="${id}"]`)
  await triggerBtn.waitFor({ state: 'visible', timeout: 10000 })
  await triggerBtn.click()

  // Digita no campo de busca
  const searchInput = page.locator(`.bootstrap-select.open .bs-searchbox input, .bootstrap-select.show .bs-searchbox input`).first()
  await searchInput.waitFor({ state: 'visible', timeout: 5000 })
  await searchInput.fill(searchText)

  // Aguarda resultado ou "sem resultados"
  await page.waitForTimeout(1500)

  const noResults = await page.locator(
    `.bootstrap-select.open .dropdown-menu li.no-results, ` +
    `.bootstrap-select.show .dropdown-menu li.no-results`
  ).count()

  if (noResults > 0) {
    await page.keyboard.press('Escape')
    throw new MotoristaNotFoundError(`Motorista "${searchText}" não encontrado no RIZER`)
  }

  const firstOption = page.locator(
    `.bootstrap-select.open .dropdown-menu li:not(.hidden):not(.no-results) a, ` +
    `.bootstrap-select.show .dropdown-menu li:not(.hidden):not(.no-results) a`
  ).first()
  await firstOption.waitFor({ state: 'visible', timeout: 6000 })
  await firstOption.click()
}

async function fillTextInput(page: Page, id: string, value: string): Promise<void> {
  const sel = `#${id}`
  await page.locator(sel).waitFor({ state: 'visible', timeout: 10000 })
  await page.click(sel)
  await page.fill(sel, value)
  // Fecha qualquer datepicker/dropdown que tenha aberto
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
}

export async function createDisciplinary(page: Page, data: OccurrenceData): Promise<void> {
  await page.goto(process.env['RIZER_DISCIPLINARY_URL']!)
  await page.waitForLoadState('networkidle')

  const pause = () => page.waitForTimeout(600)

  try {
    // MOTORISTA — Bootstrap Select com live-search; cadastra se não encontrado
    try {
      await selectBsLiveSearch(page, ids.motorista, data.motorista_nome)
    } catch (err) {
      if (!(err instanceof MotoristaNotFoundError)) throw err
      await registerMotorista(page, data)
      // Volta ao formulário da ocorrência e recomeça
      await page.goto(process.env['RIZER_DISCIPLINARY_URL']!)
      await page.waitForLoadState('networkidle')
      await selectBsLiveSearch(page, ids.motorista, data.motorista_nome)
    }
    await pause()

    // PREFIXO — testa se é select ou text input
    const prefixoTag = await page.evaluate((id) => {
      const el = document.getElementById(id)
      return el?.tagName.toLowerCase() ?? ''
    }, ids.prefixo)

    if (prefixoTag === 'select') {
      await selectBsLiveSearch(page, ids.prefixo, data.prefixo)
    } else {
      await fillTextInput(page, ids.prefixo, data.prefixo)
    }
    await pause()

    // DATA DA ABERTURA — campo disabled, preenchido automaticamente pelo sistema

    // DATA DA OCORRÊNCIA
    const dataOcorrencia = data.data_ocorrencia.includes('-')
      ? formatDate(data.data_ocorrencia)
      : data.data_ocorrencia
    await fillTextInput(page, ids.dataOcorrencia, dataOcorrencia)
    await pause()

    // RESPONSÁVEL — Bootstrap Select com live-search (igual ao motorista)
    await selectBsLiveSearch(page, ids.responsavel, data.responsavel)
    await pause()

    // TIPO DE OCORRÊNCIA — Bootstrap Select
    await selectBsOption(page, ids.tipoOcorrencia, data.tipo_ocorrencia)
    await pause()

    // OPERAÇÃO — sempre CATEDRAL (opções pré-carregadas, sem live-search)
    await selectBsOption(page, ids.operacao, 'CATEDRAL')
    await pause()

    // ADVERTÊNCIA ou SUSPENSÃO — marca o checkbox correspondente
    if (data.advertencia) {
      const advBox = page.locator(`#${ids.advertencia}`)
      if (!await advBox.isChecked()) await advBox.check({ force: true })
    } else {
      const suspBox = page.locator(`#${ids.suspensao}`)
      if (!await suspBox.isChecked()) await suspBox.check({ force: true })
    }
    await pause()

    // VISIBILIDADE — sempre "Disponivel para todos"
    await selectBsOption(page, ids.visibilidade, 'Disponivel para todos')
    await pause()

    // LINK RELATÓRIO — buscado automaticamente do Drive
    if (data.link_relatorio) {
      await fillTextInput(page, ids.linkRelatorio, data.link_relatorio)
      await pause()
    }

    // LINK DA MEDIDA — apenas para advertência
    if (data.advertencia && data.link_medida) {
      // Loga o ID real para confirmar o seletor
      const linkMedidaId = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[id*="medida"], [id*="link"]'))
          .map(el => `${el.id} (${el.tagName})`)
          .join(', ')
      )
      console.log('[disciplinary] IDs encontrados (medida/link):', linkMedidaId)

      const exists = await page.locator(`#${ids.linkMedida}`).count()
      if (exists > 0) {
        await fillTextInput(page, ids.linkMedida, data.link_medida)
        await pause()
      } else {
        console.warn(`[disciplinary] Campo "#${ids.linkMedida}" não encontrado — pulando link_medida`)
      }
    }

    // SALVAR — botão "Cadastrar" do formulário
    const saveBtn = page.locator('button.form-group-btn-add-cadastrar, button[type="submit"]:has-text("Cadastrar")')
    await saveBtn.waitFor({ state: 'visible', timeout: 10000 })
    await saveBtn.click()
    await page.waitForLoadState('networkidle', { timeout: 20000 })
  } catch (err) {
    await takeErrorScreenshot(page, 'disciplinary')
    throw err
  }
}
