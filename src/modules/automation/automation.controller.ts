import type { Request, Response } from 'express'
import { automateOccurrence, fillMedidaService } from './automation.service.js'
import type { OccurrencePayload } from './types/automation.types.js'

function apiError(res: Response, status: number, message: string, code = 'AUTOMATION_ERROR') {
  res.status(status).json({ error: { code, message } })
}

export async function disciplinaryController(req: Request, res: Response): Promise<void> {
  const payload = req.body as OccurrencePayload

  if (!payload.occurrence_id) {
    apiError(res, 400, 'Campo "occurrence_id" é obrigatório.', 'MISSING_FIELD')
    return
  }

  try {
    const { faltaTratativa } = await automateOccurrence(payload)
    res.status(200).json({ success: true, message: 'Ocorrência registrada no RIZER com sucesso.', faltaTratativa })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno na automação.'
    console.error('[controller] Erro na automação:', message)
    apiError(res, 500, message)
  }
}

export async function fillMedidaController(req: Request, res: Response): Promise<void> {
  const payload = req.body as OccurrencePayload

  if (!payload.occurrence_id) {
    apiError(res, 400, 'Campo "occurrence_id" é obrigatório.', 'MISSING_FIELD')
    return
  }

  try {
    await fillMedidaService(payload)
    res.status(200).json({ success: true, message: 'Link da medida preenchido no RIZER com sucesso.' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno na automação.'
    console.error('[controller] Erro ao preencher medida:', message)
    apiError(res, 500, message)
  }
}
