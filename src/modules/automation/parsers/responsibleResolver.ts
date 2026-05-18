import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import csv from 'csv-parser'
import Fuse from 'fuse.js'
import type { ResolvedResponsible } from '../types/automation.types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Remove acentos e normaliza para uppercase — ex: "Goiânia" → "GOIANIA"
function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim()
}

interface CSVRow {
  base: string
  responsavel: string
  visibilidade: string
}

// Linha enriquecida com campo normalizado para o Fuse
interface CSVRowNorm extends CSVRow {
  baseNorm: string
}

async function loadCSV(): Promise<CSVRowNorm[]> {
  return new Promise((resolve, reject) => {
    const rows: CSVRowNorm[] = []
    const filePath = path.resolve(__dirname, '../csv/responsaveis.csv')

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row: CSVRow) => rows.push({ ...row, baseNorm: normalize(row.base) }))
      .on('end', () => resolve(rows))
      .on('error', reject)
  })
}

export async function resolveResponsible(base_operacional: string): Promise<ResolvedResponsible> {
  const rows = await loadCSV()
  const needle = normalize(base_operacional)

  // 1. Match exato após normalização (sem acento, sem case)
  const exact = rows.find(r => r.baseNorm === needle)
  if (exact) {
    return { responsavel: exact.responsavel, visibilidade: exact.visibilidade }
  }

  // 2. Fallback fuzzy no campo normalizado
  const fuse = new Fuse(rows, { keys: ['baseNorm'], threshold: 0.35 })
  const result = fuse.search(needle)

  if (result.length === 0) {
    throw new Error(`Base operacional não encontrada no CSV: "${base_operacional}" (normalizado: "${needle}")`)
  }

  const match = result[0]!.item
  console.warn(`[resolver] Fuzzy match: "${base_operacional}" → "${match.base}" (score ${result[0]!.score?.toFixed(3)})`)
  return { responsavel: match.responsavel, visibilidade: match.visibilidade }
}
