import { google } from 'googleapis'
import type { AIExtractedData } from '../types/automation.types.js'

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
const FOLDER_ID = process.env['GOOGLE_DRIVE_FOLDER_ID']!

function getDriveClient() {
  const auth = new google.auth.JWT({
    email: process.env['GOOGLE_DRIVE_CLIENT_EMAIL']!,
    key: process.env['GOOGLE_DRIVE_PRIVATE_KEY']!.replace(/\\n/g, '\n'),
    scopes: SCOPES,
  })
  return google.drive({ version: 'v3', auth })
}

export interface DriveReport {
  fileId: string
  fileName: string
  webViewLink: string
  parsed: AIExtractedData & { tipo_ocorrencia: string }
}

// Parseia "1895 - TENORIO SOUZA VIEIRA - FEIRA DE SANTANA - PARADA_IRREG - 15.05.26"
function parseFileName(name: string): (AIExtractedData & { tipo_ocorrencia: string }) | null {
  // Remove extensão se houver
  const base = name.replace(/\.[^.]+$/, '')
  const parts = base.split(' - ').map(p => p.trim())

  if (parts.length < 5) return null
  if (!parts[3]?.includes('PARADA_IRREG')) return null

  const [prefixo, motorista_nome, base_operacional, , dataRaw] = parts

  // Data: DD.MM.YY → YYYY-MM-DD
  const dateParts = dataRaw?.split('.')
  if (!dateParts || dateParts.length < 3) return null
  const [dd, mm, yy] = dateParts
  const year = parseInt(yy!) < 50 ? `20${yy}` : `19${yy}`
  const data_ocorrencia = `${year}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}T00:00:00`

  return {
    motorista_nome: motorista_nome!,
    matricula: '',
    prefixo: prefixo!,
    base_operacional: base_operacional!,
    data_ocorrencia,
    tipo_ocorrencia: 'PARADA IRREGULAR',
  }
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()
}

/**
 * Busca no Drive o arquivo de relatório correspondente à ocorrência.
 * Padrão esperado: "{matricula} - {nome} - {base} - PARADA_IRREGULAR - {data}"
 * Retorna o webViewLink ou null se não encontrado.
 */
export async function findReportLink(params: {
  matricula: string
  motoristaNome: string
  base: string
  folderId?: string
  eventDate?: string   // YYYY-MM-DD — arquivo deve ter sido criado nessa data ou depois
  typeFilter?: string  // trecho esperado no nome do arquivo, ex: 'PARADA_IRREG'
}): Promise<string | null> {
  const drive = getDriveClient()
  const { matricula, motoristaNome, folderId = FOLDER_ID, eventDate, typeFilter } = params

  const searchTerm = matricula || normalize(motoristaNome).split(' ')[0]

  // Inclui filtro de data de criação no Drive: apenas arquivos criados a partir do dia do evento
  const dateFilter = eventDate ? ` and createdTime >= '${eventDate}T00:00:00'` : ''

  const res = await drive.files.list({
    q: `'${folderId}' in parents and name contains '${searchTerm}' and trashed = false${dateFilter}`,
    fields: 'files(id, name, webViewLink)',
    orderBy: 'createdTime desc',
    pageSize: 50,
  })

  const files = res.data.files ?? []
  console.log(`[driveScanner] ${files.length} arquivo(s) encontrado(s) para "${searchTerm}" na pasta ${folderId}`)

  // Filtra por tipo (ex: PARADA_IRREG) no nome do arquivo
  for (const file of files) {
    if (!file.name) continue
    const normFile = normalize(file.name.replace(/\.[^.]+$/, ''))

    if (typeFilter && !normFile.includes(normalize(typeFilter))) {
      console.log(`[driveScanner] ignorado (tipo): ${file.name}`)
      continue
    }

    console.log(`[driveScanner] match encontrado: ${file.name}`)
    return file.webViewLink ?? null
  }

  return null
}

export async function listParadaIrregReports(): Promise<DriveReport[]> {
  const drive = getDriveClient()

  const res = await drive.files.list({
    q: `'${FOLDER_ID}' in parents and name contains 'PARADA_IRREG' and trashed = false`,
    fields: 'files(id, name, webViewLink)',
    orderBy: 'createdTime desc',
    pageSize: 100,
  })

  const files = res.data.files ?? []
  const reports: DriveReport[] = []

  for (const file of files) {
    if (!file.id || !file.name) continue
    const parsed = parseFileName(file.name)
    if (!parsed) continue

    reports.push({
      fileId: file.id,
      fileName: file.name,
      webViewLink: file.webViewLink ?? '',
      parsed,
    })
  }

  return reports
}
