import { resolveResponsible } from './parsers/responsibleResolver.js'
import { findReportLink } from './drive/driveScanner.js'
import { createContextWithSession } from './playwright/browser.js'
import { login, isOnLoginPage } from './playwright/login.js'
import { createDisciplinary } from './playwright/disciplinary.js'
import { findRizerOccurrenceId } from './playwright/findOccurrenceInRizer.js'
import { fillMedidaOnEdit } from './playwright/editMedida.js'
import { takeErrorScreenshot } from './playwright/helpers.js'
import { getOccurrenceById, markRizerRegistered, markFaltaTratativa, clearFaltaTratativa, saveRizerData } from '../occurrences/occurrences.repo.js'
import type { OccurrencePayload, OccurrenceData } from './types/automation.types.js'

async function runAutomation(occurrenceData: OccurrenceData): Promise<string | null> {
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

    return await createDisciplinary(page, occurrenceData)
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

  const [matchRelatorio, matchMedida] = await Promise.all([
    findReportLink({ ...driveParams, folderId: relatoriosFolderId, typeFilter: 'PARADA_IRREG' }),
    advertencia
      ? findReportLink({ ...driveParams, folderId: medidasFolderId })
      : Promise.resolve(null),
  ])

  if (!matchRelatorio) throw new Error(`Relatório não encontrado no Drive para "${motoristaNome}" (${matricula}) — data: ${occ.eventDate}. Verifique se o arquivo foi enviado para a pasta correta.`)
  if (advertencia && !matchMedida) console.warn(`[service] Medida não encontrada no Drive para "${motoristaNome}"`)

  const occurrenceData: OccurrenceData = {
    motorista_nome: motoristaNome,
    matricula,
    prefixo:        occ.vehicleNumber ?? '',
    base_operacional: baseCode,
    data_ocorrencia: `${occ.eventDate}T00:00:00`,
    ...responsible,
    tipo_ocorrencia: 'PARADA IRREGULAR',
    link_relatorio: matchRelatorio.link,
    link_medida:    matchMedida?.link ?? '',
    advertencia,
  }

  const rizerId = await runAutomation(occurrenceData)

  const faltaTratativa = advertencia && !matchMedida

  console.log(`[service] advertencia=${advertencia} link_medida="${matchMedida?.link}" faltaTratativa=${faltaTratativa}`)

  await markRizerRegistered(occurrence_id)
  await saveRizerData(occurrence_id, {
    rizerId,
    driveFileNome: matchRelatorio.fileName,
  })
  if (faltaTratativa) await markFaltaTratativa(occurrence_id)

  return { faltaTratativa }
}

export async function fillMedidaService(payload: OccurrencePayload): Promise<void> {
  const { occurrence_id } = payload

  const occ = await getOccurrenceById(occurrence_id)
  if (!(occ as any).faltaTratativa) throw new Error('Esta ocorrência não está marcada como falta tratativa.')

  const driver1 = occ.drivers.find((d: any) => d.position === 1)
  if (!driver1) throw new Error('Motorista principal não encontrado na ocorrência.')

  const motoristaNome = driver1.name ?? ''
  const baseCode = driver1.baseCode ?? occ.baseCode ?? ''
  const eventDate = occ.eventDate as string
  const rizerId = (occ as any).rizerId as string | null
  const driveFileNome: string | null = (occ as any).driveFileNome ?? null

  // Se matrícula não está cadastrada, tenta extrair do nome do arquivo no Drive
  let matricula = driver1.registry ?? ''
  if (!matricula && driveFileNome) {
    const fromFile = driveFileNome.split(' - ')[0]?.trim()
    if (fromFile && /^\d+$/.test(fromFile)) {
      matricula = fromFile
      console.log(`[service] Matrícula extraída do nome do arquivo: ${matricula}`)
    }
  }

  const medidasFolderId = payload.medidas_folder_id || process.env['GOOGLE_DRIVE_MEDIDAS_FOLDER_ID']!

  const matchMedida = await findReportLink({
    matricula,
    motoristaNome,
    base: baseCode,
    folderId: medidasFolderId,
    fileName: (occ as any).driveFileNome ?? undefined,
    ...(eventDate ? { eventDate } : {}),
  })

  if (!matchMedida) throw new Error('Link da medida ainda não encontrado no Drive.')

  const { browser, context } = await createContextWithSession()
  const page = await context.newPage()

  try {
    await page.goto(process.env['RIZER_DISCIPLINARY_URL']!)
    await page.waitForLoadState('domcontentloaded')

    if (isOnLoginPage(page)) {
      console.log('[service] Sessão inválida — fazendo login...')
      await login(page, context)
    }

    let rizerOccId = rizerId
    if (!rizerOccId) {
      rizerOccId = await findRizerOccurrenceId(page, { matricula, tipoOcorrencia: 'PARADA IRREGULAR', eventDate })
      console.log(`[service] Ocorrência encontrada no RIZER via busca: ID ${rizerOccId}`)
    } else {
      console.log(`[service] Usando rizer_id salvo: ${rizerOccId}`)
    }

    await fillMedidaOnEdit(page, rizerOccId, matchMedida.link)

    await clearFaltaTratativa(occurrence_id)
    console.log(`[service] falta_tratativa removida para ocorrência ${occurrence_id}`)
  } catch (err) {
    await takeErrorScreenshot(page, 'fill_medida').catch(() => {})
    throw err
  } finally {
    await browser.close()
  }
}
