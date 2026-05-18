import type { Request, Response } from 'express'
import { automateOccurrence, fillMedidaService } from './automation.service.js'
import type { OccurrencePayload } from './types/automation.types.js'

export async function disciplinaryController(req: Request, res: Response): Promise<void> {
  const { occurrence_id } = req.body as OccurrencePayload

  if (!occurrence_id) {
    res.status(400).json({ error: 'Campo "occurrence_id" é obrigatório.' })
    return
  }

  try {
    const { faltaTratativa } = await automateOccurrence({ occurrence_id })
    res.status(200).json({ success: true, message: 'Ocorrência registrada no RIZER com sucesso.', faltaTratativa })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno na automação.'
    console.error('[controller] Erro na automação:', message)
    res.status(500).json({ error: message })
  }
}

export async function fillMedidaController(req: Request, res: Response): Promise<void> {
  const { occurrence_id } = req.body as OccurrencePayload

  if (!occurrence_id) {
    res.status(400).json({ error: 'Campo "occurrence_id" é obrigatório.' })
    return
  }

  try {
    await fillMedidaService({ occurrence_id })
    res.status(200).json({ success: true, message: 'Link da medida preenchido no RIZER com sucesso.' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno na automação.'
    console.error('[controller] Erro ao preencher medida:', message)
    res.status(500).json({ error: message })
  }
}
