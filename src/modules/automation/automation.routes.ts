import type { Express } from 'express'
import { disciplinaryController, fillMedidaController, getTratativasPendentesController } from './automation.controller.js'

export function automationRoutes(app: Express) {
  app.get('/automation/tratativas-pendentes', getTratativasPendentesController)
  app.post('/automation/disciplinary', disciplinaryController)
  app.post('/automation/fill-medida', fillMedidaController)
}
