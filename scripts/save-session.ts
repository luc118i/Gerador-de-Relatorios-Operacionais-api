import "dotenv/config"
import { chromium } from 'playwright'
import path from 'path'

const AUTH_FILE = path.resolve(process.cwd(), 'auth.json')
const LOGIN_URL = process.env['RIZER_LOGIN_URL']!

async function main() {
  console.log('🌐 Abrindo browser para login manual...')
  console.log(`📍 URL: ${LOGIN_URL}`)

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto(LOGIN_URL)

  console.log('\n✋ Faça login manualmente no browser.')
  console.log('⏳ Aguardando sair da página de login...\n')

  // Aguarda o usuário fazer login (URL muda da raiz)
  const loginBase = LOGIN_URL.replace(/\/$/, '')
  await page.waitForURL(
    url => {
      const u = url.toString()
      return u !== loginBase && u !== loginBase + '/'
    },
    { timeout: 120000 } // 2 minutos para o usuário logar
  )

  await page.waitForLoadState('networkidle')
  await context.storageState({ path: AUTH_FILE })

  console.log(`✅ Sessão salva em: ${AUTH_FILE}`)
  console.log('🤖 O robô usará essa sessão nas próximas execuções.')

  await browser.close()
}

main().catch((err) => {
  console.error('Erro:', err.message)
  process.exit(1)
})
