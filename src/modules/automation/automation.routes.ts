import type { Express } from 'express'
import { disciplinaryController } from './automation.controller.js'

export function automationRoutes(app: Express) {
  app.post('/automation/disciplinary', disciplinaryController)
}
