import { google } from 'googleapis'
import type { AIExtractedData } from '../types/automation.types.js'

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
const FOLDER_ID = process.env['GOOGLE_DRIVE_FOLDER_ID']!

function getDriveClient() {
  const raw = process.env['GOOGLE_SERVICE_ACCOUNT_JSON']
  const email = process.env['GOOGLE_DRIVE_CLIENT_EMAIL']
  const key = process.env['GOOGLE_DRIVE_PRIVATE_KEY']

  let clientEmail: string
  let privateKey: string

  const rawB64 = process.env['GOOGLE_SERVICE_ACCOUNT_JSON_B64']
  if (rawB64 || raw) {
    const json = rawB64 ? Buffer.from(rawB64, 'base64').toString('utf-8') : raw!
    const creds = JSON.parse(json)
    clientEmail = creds.client_email
    privateKey = creds.private_key
    if (!clientEmail || !privateKey) throw new Error('Credenciais do Google malformadas: faltam client_email ou private_key')
  } else if (email && key) {
    clientEmail = email
    privateKey = key.replace(/\\n/g, '\n')
  } else {
    throw new Error('Credenciais do Google Drive ausentes: defina GOOGLE_SERVICE_ACCOUNT_JSON ou GOOGLE_DRIVE_CLIENT_EMAIL + GOOGLE_DRIVE_PRIVATE_KEY')
  }

  const auth = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: SCOPES })
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
export interface DriveMatch {
  link: string
  fileName: string
}

export async function findReportLink(params: {
  matricula: string
  motoristaNome: string
  base: string
  folderId?: string
  eventDate?: string   // YYYY-MM-DD — arquivo deve ter sido criado nessa data ou depois
  typeFilter?: string  // trecho esperado no nome do arquivo, ex: 'PARADA_IRREG'
  fileName?: string    // nome exato do arquivo para busca direta
}): Promise<DriveMatch | null> {
  const drive = getDriveClient()
  const { matricula, motoristaNome, folderId = FOLDER_ID, eventDate, typeFilter, fileName } = params

  const dateFilter = eventDate ? ` and createdTime >= '${eventDate}T00:00:00'` : ''

  // Busca direta pelo nome do arquivo se disponível
  if (fileName) {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
      fields: 'files(id, name, webViewLink)',
      pageSize: 1,
    })
    const file = res.data.files?.[0]
    if (file?.webViewLink && file.name) {
      console.log(`[driveScanner] match direto por nome: ${file.name}`)
      return { link: file.webViewLink, fileName: file.name }
    }
  }

  const searchTerm = matricula || normalize(motoristaNome).split(' ')[0]

  const res = await drive.files.list({
    q: `'${folderId}' in parents and name contains '${searchTerm}' and trashed = false${dateFilter}`,
    fields: 'files(id, name, webViewLink)',
    orderBy: 'createdTime desc',
    pageSize: 50,
  })

  const files = res.data.files ?? []
  console.log(`[driveScanner] ${files.length} arquivo(s) encontrado(s) para "${searchTerm}" na pasta ${folderId}`)

  for (const file of files) {
    if (!file.name) continue
    const normFile = normalize(file.name.replace(/\.[^.]+$/, ''))

    if (typeFilter && !normFile.includes(normalize(typeFilter))) {
      console.log(`[driveScanner] ignorado (tipo): ${file.name}`)
      continue
    }

    console.log(`[driveScanner] match encontrado: ${file.name}`)
    return { link: file.webViewLink ?? '', fileName: file.name }
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
