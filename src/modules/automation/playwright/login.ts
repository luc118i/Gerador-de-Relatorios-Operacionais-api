import type { Page, BrowserContext } from 'playwright'
import { saveSession } from './browser.js'

const LOGIN_URL = process.env['RIZER_LOGIN_URL'] ?? ''

// URL exata da página de login (sem barra final)
function loginBase(): string {
  return LOGIN_URL.replace(/\/$/, '')
}

export async function login(page: Page, context: BrowserContext): Promise<void> {
  await page.goto(LOGIN_URL)
  await page.waitForLoadState('domcontentloaded')

  // pressSequentially dispara evento por tecla — necessário para inputs React controlados
  const userInput = page.locator('input[placeholder="Digite seu usuário"]')
  await userInput.waitFor({ state: 'visible' })
  await userInput.click()
  await userInput.pressSequentially(process.env['RIZER_EMAIL']!, { delay: 50 })

  const passInput = page.locator('input[type="password"]')
  await passInput.click()
  await passInput.pressSequentially(process.env['RIZER_PASSWORD']!, { delay: 50 })

  await page.click('button[type="submit"]')

  // Aguarda URL mudar para qualquer coisa diferente da página de login
  await page.waitForURL(
    url => {
      const u = url.toString()
      return u !== loginBase() && u !== loginBase() + '/'
    },
    { timeout: 15000 }
  )
  await page.waitForLoadState('networkidle')

  await saveSession(context)
}

export function isOnLoginPage(page: Page): boolean {
  const url = page.url()
  const base = loginBase()
  // É a página de login se a URL é exatamente a raiz do sistema ou contém /login
  return url === base || url === base + '/' || url.includes('/login') || url.includes('/auth')
}
