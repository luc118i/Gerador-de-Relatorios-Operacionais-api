import { resolveResponsible } from './parsers/responsibleResolver.js'
import { findReportLink } from './drive/driveScanner.js'
import { createContextWithSession } from './playwright/browser.js'
import { login, isOnLoginPage } from './playwright/login.js'
import { createDisciplinary } from './playwright/disciplinary.js'
import { findRizerOccurrenceId } from './playwright/findOccurrenceInRizer.js'
import { fillMedidaOnEdit } from './playwright/editMedida.js'
import { takeErrorScreenshot } from './playwright/helpers.js'
import { getOccurrenceById, markRizerRegistered, markFaltaTratativa, clearFaltaTratativa } from '../occurrences/occurrences.repo.js'
import type { OccurrencePayload, OccurrenceData } from './types/automation.types.js'

async function runAutomation(occurrenceData: OccurrenceData): Promise<void> {
  const { browser, context } = await createContextWithSession()
  const page = await context.newPage()

  try {
    await page.goto(process.env['RIZER_DISCIPLINARY_URL']!)
    await page.waitForLoadState('domcontentloaded')

    if (isOnLoginPage(page)) {
      console.log('[service] Sessão inválida — fazendo login...')
      await login(page, context)
      await page.goto(process.env['RIZER_DISCIPLINARY_URL']!)
      await page.waitForLoadState('domcontentloaded')
    }

    await createDisciplinary(page, occurrenceData)
  } catch (err) {
    await takeErrorScreenshot(page, 'service')
    throw err
  } finally {
    await browser.close()
  }
}

export async function automateOccurrence(payload: OccurrencePayload): Promise<{ faltaTratativa: boolean }> {
  const { occurrence_id } = payload

  // Busca ocorrência no Supabase
  const occ = await getOccurrenceById(occurrence_id)

  if ((occ as any).rizerRegistered) {
    throw new Error('Esta ocorrência já foi registrada no RIZER.')
  }

  const driver1 = occ.drivers.find((d: any) => d.position === 1)
  if (!driver1) throw new Error('Motorista principal não encontrado na ocorrência.')

  const baseCode = driver1.baseCode ?? occ.baseCode ?? ''
  const responsible = await resolveResponsible(baseCode)

  const matricula = driver1.registry ?? ''
  const motoristaNome = driver1.name ?? ''

  const eventDate = occ.eventDate as string | undefined
  const driveParams = {
    matricula,
    motoristaNome,
    base: baseCode,
    ...(eventDate ? { eventDate } : {}),
  }

  const advertencia: boolean = (occ as any).advertencia ?? true

  // Busca link do relatório sempre; medida só para advertência
  const relatoriosFolderId = payload.relatorios_folder_id || process.env['GOOGLE_DRIVE_FOLDER_ID']!
  const medidasFolderId = payload.medidas_folder_id || process.env['GOOGLE_DRIVE_MEDIDAS_FOLDER_ID']!

  const [link_relatorio, link_medida] = await Promise.all([
    findReportLink({ ...driveParams, folderId: relatoriosFolderId, typeFilter: 'PARADA_IRREG' }),
    advertencia
      ? findReportLink({ ...driveParams, folderId: medidasFolderId })
      : Promise.resolve(null),
  ])

  if (!link_relatorio) throw new Error(`Relatório não encontrado no Drive para "${motoristaNome}" (${matricula}) — data: ${occ.eventDate}. Verifique se o arquivo foi enviado para a pasta correta.`)
  if (advertencia && !link_medida) console.warn(`[service] Medida não encontrada no Drive para "${motoristaNome}"`)

  const occurrenceData: OccurrenceData = {
    motorista_nome: motoristaNome,
    matricula,
    prefixo:        occ.vehicleNumber ?? '',
    base_operacional: baseCode,
    data_ocorrencia: `${occ.eventDate}T00:00:00`,
    ...responsible,
    tipo_ocorrencia: 'PARADA IRREGULAR',
    link_relatorio: link_relatorio ?? '',
    link_medida:    link_medida ?? '',
    advertencia,
  }

  await runAutomation(occurrenceData)

  const faltaTratativa = advertencia && !link_medida

  console.log(`[service] advertencia=${advertencia} link_medida="${link_medida}" faltaTratativa=${faltaTratativa}`)

  // Marca registrado primeiro (crítico), depois falta_tratativa (secundário)
  await markRizerRegistered(occurrence_id)
  if (faltaTratativa) await markFaltaTratativa(occurrence_id)

  return { faltaTratativa }
}

export async function fillMedidaService(payload: OccurrencePayload): Promise<void> {
  const { occurrence_id } = payload

  const occ = await getOccurrenceById(occurrence_id)
  if (!(occ as any).faltaTratativa) throw new Error('Esta ocorrência não está marcada como falta tratativa.')

  const driver1 = occ.drivers.find((d: any) => d.position === 1)
  if (!driver1) throw new Error('Motorista principal não encontrado na ocorrência.')

  const matricula = driver1.registry ?? ''
  const motoristaNome = driver1.name ?? ''
  const baseCode = driver1.baseCode ?? occ.baseCode ?? ''
  const eventDate = occ.eventDate as string

  const medidasFolderId = payload.medidas_folder_id || process.env['GOOGLE_DRIVE_MEDIDAS_FOLDER_ID']!

  // Busca link da medida no Drive (agora deve existir)
  const link_medida = await findReportLink({
    matricula,
    motoristaNome,
    base: baseCode,
    folderId: medidasFolderId,
    ...(eventDate ? { eventDate } : {}),
  })

  if (!link_medida) throw new Error('Link da medida ainda não encontrado no Drive.')

  const { browser, context } = await createContextWithSession()
  const page = await context.newPage()

  try {
    await page.goto(process.env['RIZER_DISCIPLINARY_URL']!)
    await page.waitForLoadState('domcontentloaded')

    if (isOnLoginPage(page)) {
      console.log('[service] Sessão inválida — fazendo login...')
      await login(page, context)
    }

    const tipoOcorrencia = (occ as any).typeTitle ?? 'PARADA IRREGULAR'

    const rizerId = await findRizerOccurrenceId(page, { matricula, tipoOcorrencia, eventDate })
    console.log(`[service] Ocorrência encontrada no RIZER: ID ${rizerId}`)

    await fillMedidaOnEdit(page, rizerId, link_medida)

    await clearFaltaTratativa(occurrence_id)
    console.log(`[service] falta_tratativa removida para ocorrência ${occurrence_id}`)
  } catch (err) {
    await takeErrorScreenshot(page, 'fill_medida').catch(() => {})
    throw err
  } finally {
    await browser.close()
  }
}
