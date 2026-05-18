import type { Page } from 'playwright'
import path from 'path'
import fs from 'fs'

const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'screenshots')

export async function takeErrorScreenshot(page: Page, label: string): Promise<string> {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `error_${label}_${timestamp}.png`
  const filepath = path.join(SCREENSHOTS_DIR, filename)

  await page.screenshot({ path: filepath, fullPage: true })
  console.error(`[helpers] Screenshot salvo: ${filepath}`)

  return filepath
}
