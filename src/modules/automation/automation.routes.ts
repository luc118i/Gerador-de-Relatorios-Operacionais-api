import type { Express } from 'express'
import { disciplinaryController, fillMedidaController } from './automation.controller.js'

export function automationRoutes(app: Express) {
  app.post('/automation/disciplinary', disciplinaryController)
  app.post('/automation/fill-medida', fillMedidaController)
}
