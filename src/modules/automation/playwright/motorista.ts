import type { Page } from 'playwright'
import type { OccurrenceData } from '../types/automation.types.js'

const MOTORISTA_URL = 'https://viacaocatedralocorrencias.rizerapps.com/cadastro_motorista/create'

async function selectBsForce(page: Page, id: string, value: string): Promise<void> {
  const sel = `#${id}`
  try {
    await page.selectOption(sel, { label: value }, { force: true, timeout: 4000 })
  } catch {
    await page.evaluate(({ sel, val }) => {
      const el = document.querySelector(sel) as HTMLSelectElement | null
      if (!el) return
      const needle = val.toLowerCase()
      for (const opt of Array.from(el.options)) {
        if (opt.text.toLowerCase().includes(needle)) {
          el.value = opt.value
          el.dispatchEvent(new Event('change', { bubbles: true }))
          if ((window as any).$) (window as any).$(el).selectpicker('refresh')
          return
        }
      }
    }, { sel, val: value })
  }
}

export async function registerMotorista(page: Page, data: OccurrenceData): Promise<void> {
  console.log(`[motorista] Cadastrando novo motorista: ${data.motorista_nome}`)

  await page.goto(MOTORISTA_URL)
  await page.waitForLoadState('networkidle')

  // MATRÍCULA (se disponível)
  if (data.matricula) {
    await page.fill('#input_matricula', data.matricula)
    await page.waitForTimeout(400)
  }

  // NOME
  await page.fill('#input_nome_motorista', data.motorista_nome)
  await page.waitForTimeout(400)

  // BASE
  await page.fill('#input_base', data.base_operacional)
  await page.waitForTimeout(400)

  // EMPRESA/PARCERIA — sempre CATEDRAL
  await selectBsForce(page, 'input_empresa_parceria', 'CATEDRAL')
  await page.waitForTimeout(400)

  // SITUAÇÃO — sempre Ativo
  await selectBsForce(page, 'input_situacao', 'Ativo')
  await page.waitForTimeout(400)

  // VISIBILIDADE — sempre Disponivel para todos
  await selectBsForce(page, 'r_auth', 'Disponivel para todos')
  await page.waitForTimeout(400)

  // CADASTRAR
  const saveBtn = page.locator('button.form-group-btn-add-cadastrar, button[type="submit"]:has-text("Cadastrar")')
  await saveBtn.waitFor({ state: 'visible', timeout: 8000 })
  await saveBtn.click()
  await page.waitForLoadState('networkidle', { timeout: 15000 })

  console.log(`[motorista] Motorista cadastrado: ${data.motorista_nome}`)
}
