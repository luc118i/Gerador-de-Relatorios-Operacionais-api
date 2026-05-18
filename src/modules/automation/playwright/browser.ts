import { chromium } from 'playwright'
import type { BrowserContext } from 'playwright'
import path from 'path'
import fs from 'fs'

const AUTH_FILE = path.resolve(process.cwd(), 'auth.json')

export async function createBrowser() {
  return chromium.launch({
    headless: true,
  })
}

export async function createContextWithSession() {
  const browser = await createBrowser()
  const hasSession = fs.existsSync(AUTH_FILE)

  const context = await browser.newContext(
    hasSession ? { storageState: AUTH_FILE } : {}
  )

  return { browser, context }
}

export async function saveSession(context: BrowserContext) {
  await context.storageState({ path: AUTH_FILE })
}
