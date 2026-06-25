import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs'

const TEMPLATES_DIR = path.join(process.cwd(), 'public', 'templates')

const MONTHS_FR = [
  'JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN',
  'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE',
]

async function loadTemplate(filename: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  const templatePath = path.join(TEMPLATES_DIR, filename)
  if (!fs.existsSync(templatePath)) throw new Error(`Canevas introuvable: ${filename}`)
  await wb.xlsx.readFile(templatePath)
  wb.calcProperties.fullCalcOnLoad = true
  return wb
}

function excelBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  wb.calcProperties.fullCalcOnLoad = true
  return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>
}

function monthSheetName(yearMonth: string) {
  const mm = yearMonth.slice(5, 7)
  const yy = yearMonth.slice(2, 4)
  return `${mm}-${yy}`
}

function dimagazSheetName(yearMonth: string) {
  const mm = yearMonth.slice(5, 7)
  const yyyy = yearMonth.slice(0, 4)
  return `${mm} ${yyyy}`
}

function monthTitle(yearMonth: string) {
  const monthIndex = Number(yearMonth.slice(5, 7)) - 1
  const year = yearMonth.slice(0, 4)
  return `${MONTHS_FR[monthIndex]} ${year}`
}

function safeSheetName(name: string) {
  return name.replace(/[\\/*?:\[\]]/g, '-').slice(0, 31)
}

function cloneCell(src: ExcelJS.Cell, dst: ExcelJS.Cell) {
  dst.value = src.value
  dst.style = JSON.parse(JSON.stringify(src.style || {}))
  if (src.numFmt) dst.numFmt = src.numFmt
  if (src.alignment) dst.alignment = JSON.parse(JSON.stringify(src.alignment))
  if (src.border) dst.border = JSON.parse(JSON.stringify(src.border))
  if (src.fill) dst.fill = JSON.parse(JSON.stringify(src.fill))
  if (src.font) dst.font = JSON.parse(JSON.stringify(src.font))
  if (src.protection) dst.protection = JSON.parse(JSON.stringify(src.protection))
}

function copyWorksheetFromTemplate(wb: ExcelJS.Workbook, template: ExcelJS.Worksheet, name: string) {
  const finalName = safeSheetName(name)
  const existing = wb.getWorksheet(finalName)
  if (existing) wb.removeWorksheet(existing.id)
  const ws = wb.addWorksheet(finalName, {
    properties: JSON.parse(JSON.stringify(template.properties || {})),
    pageSetup: JSON.parse(JSON.stringify(template.pageSetup || {})),
    views: JSON.parse(JSON.stringify(template.views || [])),
  })
  ws.state = template.state
  ws.properties = JSON.parse(JSON.stringify(template.properties || {}))
  ws.pageSetup = JSON.parse(JSON.stringify(template.pageSetup || {}))
  ws.views = JSON.parse(JSON.stringify(template.views || []))
  ws.headerFooter = JSON.parse(JSON.stringify(template.headerFooter || {}))
  template.columns?.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width
    ws.getColumn(i + 1).hidden = col.hidden
    ws.getColumn(i + 1).outlineLevel = col.outlineLevel
    ws.getColumn(i + 1).style = JSON.parse(JSON.stringify(col.style || {}))
  })
  template.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const targetRow = ws.getRow(rowNumber)
    targetRow.height = row.height
    targetRow.hidden = row.hidden
    targetRow.outlineLevel = row.outlineLevel
    ;(targetRow as any).style = JSON.parse(JSON.stringify((row as any).style || {}))
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => cloneCell(cell, targetRow.getCell(colNumber)))
    targetRow.commit?.()
  })
  // Copy merged cells from the public model first. Using only the private _merges object
  // loses merges in many ExcelJS versions, which makes the Rapport Journalier Mensuel
  // unreadable because all merged titles are split/repeated across columns.
  const model: any = (template as any).model || {}
  const mergeRanges = new Set<string>()
  if (Array.isArray(model.merges)) model.merges.forEach((r: string) => mergeRanges.add(r))
  if (Array.isArray(model.mergeCells)) model.mergeCells.forEach((r: string) => mergeRanges.add(r))
  const privateMerges: any = (template as any)._merges
  if (privateMerges) {
    if (privateMerges instanceof Map) {
      privateMerges.forEach((v: any, k: any) => {
        if (typeof v?.range === 'string') mergeRanges.add(v.range)
        else if (typeof k === 'string' && k.includes(':')) mergeRanges.add(k)
      })
    } else {
      Object.keys(privateMerges).forEach(k => {
        const v = privateMerges[k]
        if (typeof v?.range === 'string') mergeRanges.add(v.range)
        else if (k.includes(':')) mergeRanges.add(k)
      })
    }
  }
  mergeRanges.forEach(range => {
    try { ws.mergeCells(range) } catch { /* ignore already-merged ranges */ }
  })
  return ws
}

function getOrPrepareSheet(wb: ExcelJS.Workbook, targetName: string): ExcelJS.Worksheet {
  let ws = wb.getWorksheet(targetName)
  if (ws) return ws
  const normalized = targetName.replace('-', ' ').trim()
  wb.eachSheet(s => {
    const n = s.name.trim().replace(/\s+/g, ' ')
    if (n === normalized || n === targetName) ws = s
  })
  if (ws) {
    ws.name = targetName
    return ws
  }
  ws = wb.worksheets[0]
  ws.name = targetName
  return ws
}

function setInput(ws: ExcelJS.Worksheet, coord: string, value: ExcelJS.CellValue) {
  if (value === undefined || value === null || value === '') return
  const cell = ws.getCell(coord)
  if (cell.type === ExcelJS.ValueType.Formula) return
  cell.value = value
}

function setAny(ws: ExcelJS.Worksheet, coord: string, value: ExcelJS.CellValue) {
  if (value === undefined || value === null || value === '') return
  ws.getCell(coord).value = value
}

function parseDate(s: string | null | undefined) {
  return s ? new Date(s) : null
}

function norm(s: string | null | undefined) {
  return (s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function sumRows<T>(rows: T[], f: (r: T) => number) {
  return rows.reduce((s, r) => s + (f(r) || 0), 0)
}

export type VenteRow = {
  date: string
  client: string
  marque: string
  numero_bc?: string | null
  qte_12kg: number
  qte_3kg: number
  qte_6kg: number
  poids_kg?: number
  poids_t?: number
}

export type ApproRow = {
  mois: string
  quinzaine: string | null
  camion: string | null
  transporteur: string | null
  numero_bc: string | null
  date_bc: string | null
  produit: string | null
  provenance: string | null
  numero_bl: string | null
  date_bl: string | null
  numero_br: string | null
  date_br: string
  q_net: number
  q_bl: number
  ecart?: number
}

export interface RapportJournalierData {
  date: string
  approGazber: number
  approSomas: number
  approSomasLiv: number
  approDegazage: number
  approKg: number
  approCumulGazber: number
  approCumulSomas: number
  approCumulSomasLiv: number
  approCumulDegazage: number
  approCumulMois: number
  debutNbre12: number
  debutNbre3: number
  debutNbre6: number
  debutCondKg: number
  debutVracKg: number
  liv: Record<'TOTAL' | 'AFRIQUIA' | 'TPZ' | 'VIVO' | 'DIMAGAZ', { n12: number; n3: number; n6: number }>
  finNbre12: number
  finNbre3: number
  finNbre6: number
  finCondKg: number
  finVracKg: number
  stockComptableFin: number
}

export async function fillApprovisionnements(rows: ApproRow[], yearMonth: string): Promise<Buffer> {
  const wb = await loadTemplate('APPROVISIONNEMENTS.xlsx')
  const ws = getOrPrepareSheet(wb, monthSheetName(yearMonth))
  setAny(ws, 'I3', `APPROVISIONNEMENTS BUTANE ${monthTitle(yearMonth)}`)
  rows.forEach((r, i) => {
    const row = 7 + i
    setInput(ws, `A${row}`, r.mois)
    setInput(ws, `B${row}`, r.quinzaine)
    setInput(ws, `C${row}`, r.camion)
    setInput(ws, `D${row}`, r.transporteur)
    setInput(ws, `E${row}`, r.numero_bc)
    setInput(ws, `F${row}`, parseDate(r.date_bc))
    setInput(ws, `G${row}`, r.produit)
    setInput(ws, `H${row}`, r.provenance)
    setInput(ws, `I${row}`, r.numero_bl)
    setInput(ws, `J${row}`, parseDate(r.date_bl))
    setInput(ws, `K${row}`, r.numero_br)
    setInput(ws, `L${row}`, parseDate(r.date_br))
    setInput(ws, `M${row}`, r.q_net)
    setInput(ws, `N${row}`, r.q_bl)
    // O = formule du canevas, ne jamais écraser. Si la ligne nouvelle n'a pas de formule, on la pose sans modifier le style.
    if (!ws.getCell(`O${row}`).value) ws.getCell(`O${row}`).value = { formula: `M${row}-N${row}` }
  })
  return excelBuffer(wb)
}

function getCellNumber(cell: ExcelJS.Cell) {
  const v = cell.value
  if (typeof v === 'number') return v
  if (typeof v === 'string') return Number(v) || 0
  return 0
}

function addInput(ws: ExcelJS.Worksheet, coord: string, value: number) {
  if (!value) return
  const cell = ws.getCell(coord)
  if (cell.type === ExcelJS.ValueType.Formula) return
  cell.value = getCellNumber(cell) + value
}

function aggregateVentes(rows: VenteRow[]) {
  const map = new Map<string, VenteRow>()
  for (const r of rows) {
    const key = `${r.date}|${norm(r.marque)}|${norm(r.client)}|${r.numero_bc || ''}`
    const cur = map.get(key)
    if (!cur) map.set(key, { ...r })
    else {
      cur.qte_12kg += Number(r.qte_12kg || 0)
      cur.qte_3kg += Number(r.qte_3kg || 0)
      cur.qte_6kg += Number(r.qte_6kg || 0)
      cur.poids_kg = (cur.poids_kg || 0) + (r.poids_kg || 0)
      cur.poids_t = (cur.poids_t || 0) + (r.poids_t || 0)
    }
  }
  return [...map.values()]
}

function fillVenteGrid(ws: ExcelJS.Worksheet, rows: VenteRow[], startRow: number, clientCols: Record<string, { c12?: string; c3?: string; c6?: string }>) {
  const grouped = aggregateVentes(rows)
  grouped.forEach(v => {
    const day = Number(v.date.slice(8, 10))
    const row = startRow + day - 1
    setInput(ws, `A${row}`, parseDate(v.date))
    const cols = clientCols[norm(v.client)]
    if (!cols) return
    if (cols.c12) addInput(ws, `${cols.c12}${row}`, v.qte_12kg)
    if (cols.c3) addInput(ws, `${cols.c3}${row}`, v.qte_3kg)
    if (cols.c6) addInput(ws, `${cols.c6}${row}`, v.qte_6kg)
  })
}

export async function fillVenteAfriquia(rows: VenteRow[], yearMonth: string): Promise<Buffer> {
  const wb = await loadTemplate('VENTE_AFRIQUIA.xlsx')
  const ws = getOrPrepareSheet(wb, monthSheetName(yearMonth))
  fillVenteGrid(ws, rows, 11, {
    [norm('SUD DIR')]: { c12: 'B', c3: 'C', c6: 'D' },
    [norm('ABOUDRAR')]: { c12: 'E', c3: 'F', c6: 'G' },
    [norm('OUFRIGAZ')]: { c12: 'H', c3: 'I', c6: 'J' },
    [norm('BAOUANOU')]: { c12: 'K', c3: 'L', c6: 'M' },
    [norm('CHARAF GAZ')]: { c12: 'N', c3: 'O', c6: 'P' },
    [norm('ZAMOU ABDELLAH')]: { c12: 'Q', c3: 'R', c6: 'S' },
  })
  return excelBuffer(wb)
}

export async function fillVenteTissir(rows: VenteRow[], yearMonth: string): Promise<Buffer> {
  const wb = await loadTemplate('VENTE_TISSIR.xlsx')
  const ws = getOrPrepareSheet(wb, monthSheetName(yearMonth))
  fillVenteGrid(ws, rows, 9, {
    [norm('SDBG')]: { c12: 'B', c3: 'C', c6: 'D' },
    [norm('AIT ZAMOU')]: { c12: 'E', c3: 'F', c6: 'G' },
    [norm('ZAMZAMGAZ')]: { c12: 'H', c3: 'I', c6: 'J' },
    [norm('OUBELLA')]: { c12: 'K', c3: 'L', c6: 'M' },
  })
  return excelBuffer(wb)
}

export async function fillVenteVivo(rows: VenteRow[], yearMonth: string): Promise<Buffer> {
  const wb = await loadTemplate('VENTE_VIVO.xlsx')
  const ws = getOrPrepareSheet(wb, monthSheetName(yearMonth))
  aggregateVentes(rows).forEach((r, i) => {
    const row = 7 + i
    setInput(ws, `A${row}`, parseDate(r.date))
    setInput(ws, `B${row}`, r.numero_bc || '')
    setInput(ws, `C${row}`, r.qte_12kg)
    setInput(ws, `D${row}`, r.qte_3kg)
    // E = formule tonnage.
  })
  return excelBuffer(wb)
}

export async function fillVenteTEDimagaz(rows: VenteRow[], yearMonth: string): Promise<Buffer> {
  const wb = await loadTemplate('VENTE_TOTALENERGIES_ET_DIMAGAZ.xlsx')
  const ws = getOrPrepareSheet(wb, monthSheetName(yearMonth))
  fillVenteGrid(ws, rows, 10, {
    [norm('WESALSAT')]: { c12: 'B', c3: 'C', c6: 'D' },
    [norm('EL MEZOUARI TTG')]: { c12: 'E', c3: 'F', c6: 'G' },
    [norm('SOBADEGAZ')]: { c12: 'H', c3: 'I', c6: 'J' },
    [norm('LWAZIZ')]: { c12: 'K', c3: 'L' },
    [norm('BASSAINE')]: { c12: 'M', c3: 'N', c6: 'O' },
    [norm('IDALI')]: { c12: 'P', c3: 'Q', c6: 'R' },
    [norm('AIT CHOUT')]: { c12: 'S', c3: 'T', c6: 'U' },
    [norm('ORANGEGAZ')]: { c12: 'V', c3: 'W', c6: 'X' },
    [norm('TAMONT')]: { c12: 'Y', c3: 'Z', c6: 'AA' },
    [norm('FRIDI')]: { c12: 'AQ', c3: 'AR', c6: 'AS' },
  })
  return excelBuffer(wb)
}

export async function fillSuiviDimagaz(rows: VenteRow[], yearMonth: string): Promise<Buffer> {
  const wb = await loadTemplate('SUIVI_DIMA_GAZ.xlsx')
  const ws = getOrPrepareSheet(wb, dimagazSheetName(yearMonth))
  setAny(ws, 'C8', `MOIS ${yearMonth.slice(5, 7)} ${yearMonth.slice(0, 4)}`)
  aggregateVentes(rows).forEach((r, i) => {
    const row = 11 + i
    setInput(ws, `A${row}`, parseDate(r.date))
    setInput(ws, `B${row}`, r.numero_bc || '')
    setInput(ws, `C${row}`, r.qte_3kg)
    setInput(ws, `D${row}`, r.qte_6kg)
    setInput(ws, `E${row}`, r.qte_12kg)
    setInput(ws, `F${row}`, r.client)
    // G = formule tonnage.
  })
  return excelBuffer(wb)
}

export async function fillStockEtVentes(rows: Array<{ date: string; stockVracFinT: number; ventesT: number; citernes: number }>, yearMonth: string): Promise<Buffer> {
  const wb = await loadTemplate('STOCK_ET_VENTES.xlsx')
  const ws = getOrPrepareSheet(wb, monthSheetName(yearMonth))
  setInput(ws, 'G1', parseDate(`${yearMonth}-01`))
  const end = new Date(Number(yearMonth.slice(0, 4)), Number(yearMonth.slice(5, 7)), 0)
  setInput(ws, 'G2', end)
  rows.forEach(r => {
    const row = 7 + Number(r.date.slice(8, 10)) - 1
    setInput(ws, `A${row}`, parseDate(r.date))
    setInput(ws, `B${row}`, r.stockVracFinT)
    setInput(ws, `C${row}`, r.ventesT)
    setInput(ws, `D${row}`, r.citernes)
  })
  // C38 = somme des ventes des journées enregistrées.
  if (ws.getCell('C38').type !== ExcelJS.ValueType.Formula) ws.getCell('C38').value = { formula: 'SUM(C7:C37)' }
  return excelBuffer(wb)
}

export async function fillRapportJournalier(d: RapportJournalierData): Promise<Buffer> {
  const wb = await loadTemplate('Rapport_Journalier_template.xlsx')
  const ws = wb.worksheets[0]
  const dt = new Date(d.date)
  ws.name = safeSheetName(`${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`)
  fillRapportSheet(ws, d)
  return excelBuffer(wb)
}

function fillRapportSheet(ws: ExcelJS.Worksheet, d: RapportJournalierData) {
  const dt = new Date(d.date)
  const ddmmyyyy = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
  setAny(ws, 'A6', `JOURNEE DU : ${ddmmyyyy}`)

  setInput(ws, 'B10', d.approGazber)
  setInput(ws, 'C10', d.approSomas)
  setInput(ws, 'D10', d.approSomasLiv)
  setInput(ws, 'E10', d.approDegazage)
  setInput(ws, 'B11', d.approCumulGazber)
  setInput(ws, 'C11', d.approCumulSomas)
  setInput(ws, 'D11', d.approCumulSomasLiv)
  setInput(ws, 'E11', d.approCumulDegazage)

  setInput(ws, 'B15', d.debutNbre12)
  setInput(ws, 'D15', d.debutNbre3)
  setInput(ws, 'F15', d.debutNbre6)
  setInput(ws, 'H15', d.debutCondKg)
  setInput(ws, 'I15', d.debutVracKg)

  const rowByMarque: Record<keyof RapportJournalierData['liv'], number> = { TOTAL: 17, AFRIQUIA: 19, TPZ: 21, VIVO: 23, DIMAGAZ: 25 }
  ;(Object.keys(rowByMarque) as Array<keyof RapportJournalierData['liv']>).forEach(m => {
    const row = rowByMarque[m]
    const v = d.liv[m]
    setInput(ws, `B${row}`, v.n12)
    setInput(ws, `D${row}`, v.n3)
    setInput(ws, `F${row}`, v.n6)
    setInput(ws, `C${row}`, v.n12 * 12)
    setInput(ws, `E${row}`, v.n3 * 3)
    setInput(ws, `G${row}`, v.n6 * 6)
    setInput(ws, `H${row}`, v.n12 * 12 + v.n3 * 3 + v.n6 * 6)
  })

  setInput(ws, 'B30', d.finNbre12)
  setInput(ws, 'D30', d.finNbre3)
  setInput(ws, 'F30', d.finNbre6)
  setInput(ws, 'H30', d.finCondKg)
  setInput(ws, 'I30', d.finVracKg)
  setInput(ws, 'E40', d.stockComptableFin)
}

export async function fillRapportJournalierMensuel(reports: RapportJournalierData[]): Promise<Buffer> {
  const base = await loadTemplate('Rapport_Journalier_template.xlsx')
  const template = base.worksheets[0]
  // Keep a clean in-memory template, then remove it before adding day sheets to avoid duplicate sheet names.
  const templateId = template.id
  for (const r of reports) {
    const dt = new Date(r.date)
    const name = `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`
    const ws = copyWorksheetFromTemplate(base, template, name)
    fillRapportSheet(ws, r)
  }
  base.removeWorksheet(templateId)
  return excelBuffer(base)
}

export async function fillRecap(rows: Array<{ date: string; boniMaliT: number; emplissageT: number; ventesT: number; boniMaliPct: number; stockVracT: number; stockCondT: number; citernes: number }>, year: string): Promise<Buffer> {
  const wb = await loadTemplate('RECAP.xlsx')
  let ws = wb.getWorksheet(year) || wb.worksheets[0]
  ws.name = year
  rows.forEach(r => {
    const date = new Date(r.date)
    const month = date.getMonth()
    const day = date.getDate()
    const row = 4 + day
    const col = 2 + month * 7
    setInput(ws, rowCol(row, col), r.boniMaliT)
    setInput(ws, rowCol(row, col + 1), r.emplissageT)
    setInput(ws, rowCol(row, col + 2), r.ventesT)
    setInput(ws, rowCol(row, col + 3), r.boniMaliPct)
    setInput(ws, rowCol(row, col + 4), r.stockVracT)
    setInput(ws, rowCol(row, col + 5), r.stockCondT)
    setInput(ws, rowCol(row, col + 6), r.citernes)
  })

  const parMois = wb.getWorksheet('Par mois')
  if (parMois) {
    for (let m = 0; m < 12; m++) {
      const subset = rows.filter(r => Number(r.date.slice(5, 7)) === m + 1)
      const row = 8 + m
      setInput(parMois, `T${row}`, sumRows(subset, r => r.boniMaliT))
      setInput(parMois, `U${row}`, sumRows(subset, r => r.ventesT))
      setInput(parMois, `V${row}`, sumRows(subset, r => Math.max(0, r.boniMaliT)))
    }
  }
  return excelBuffer(wb)
}

function rowCol(row: number, col: number) {
  let s = ''
  let n = col
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return `${s}${row}`
}
