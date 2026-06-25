import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getStockDebut } from '@/lib/business'
import JSZip from 'jszip'
import {
  fillApprovisionnements,
  fillVenteAfriquia,
  fillVenteTissir,
  fillVenteVivo,
  fillVenteTEDimagaz,
  fillSuiviDimagaz,
  fillRapportJournalier,
  fillRapportJournalierMensuel,
  fillStockEtVentes,
  fillRecap,
  type RapportJournalierData,
  type VenteRow,
} from '@/lib/excel-export'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function xlsxResponse(buffer: Buffer, filename: string) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

function monthBounds(yearMonth: string) {
  const y = Number(yearMonth.slice(0, 4))
  const m = Number(yearMonth.slice(5, 7))
  const last = new Date(y, m, 0).getDate()
  return { start: `${yearMonth}-01`, end: `${yearMonth}-${String(last).padStart(2, '0')}` }
}

function daysBetween(start: string, end: string) {
  const out: string[] = []
  const d = new Date(`${start}T00:00:00`)
  const last = new Date(`${end}T00:00:00`)
  while (d <= last) {
    out.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return out
}

function fileMonth(ym: string) {
  return ym.replace('-', '_')
}

async function getVentes(start: string, end: string, marques?: string[]) {
  const data = await prisma.venteClient.findMany({
    where: { ...(marques ? { marque: { in: marques } } : {}), date: { gte: start, lte: end } },
    orderBy: [{ date: 'asc' }, { client: 'asc' }],
  })
  return data as unknown as VenteRow[]
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || ''
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const yearMonth = date.slice(0, 7)
  const year = date.slice(0, 4)
  const { start, end } = monthBounds(yearMonth)

  try {
    if (type === 'approvisionnements') {
      const data = await prisma.approvisionnement.findMany({ where: { date_br: { gte: start, lte: end } }, orderBy: [{ date_br: 'asc' }, { id: 'asc' }] })
      return xlsxResponse(await fillApprovisionnements(data, yearMonth), `APPROVISIONNEMENTS_${fileMonth(yearMonth)}.xlsx`)
    }

    if (type === 'vente_afriquia') {
      return xlsxResponse(await fillVenteAfriquia(await getVentes(start, end, ['AFRIQUIA GAZ']), yearMonth), `VENTE_AFRIQUIA_${fileMonth(yearMonth)}.xlsx`)
    }

    if (type === 'vente_tissir') {
      return xlsxResponse(await fillVenteTissir(await getVentes(start, end, ['TISSIR', 'TPZ']), yearMonth), `VENTE_TISSIR_${fileMonth(yearMonth)}.xlsx`)
    }

    if (type === 'vente_vivo') {
      return xlsxResponse(await fillVenteVivo(await getVentes(start, end, ['VIVO ENERGY']), yearMonth), `VENTE_VIVO_${fileMonth(yearMonth)}.xlsx`)
    }

    if (type === 'vente_te_dimagaz') {
      return xlsxResponse(await fillVenteTEDimagaz(await getVentes(start, end, ['TOTAL GAZ', 'TOTALENERGIES', 'SAADA', 'DIMAGAZ']), yearMonth), `VENTE_TOTALENERGIES_DIMAGAZ_${fileMonth(yearMonth)}.xlsx`)
    }

    if (type === 'suivi_dimagaz') {
      return xlsxResponse(await fillSuiviDimagaz(await getVentes(start, end, ['DIMAGAZ']), yearMonth), `SUIVI_DIMAGAZ_${fileMonth(yearMonth)}.xlsx`)
    }

    if (type === 'rapport_journalier') {
      return xlsxResponse(await buildDailyReport(date).then(fillRapportJournalier), `Rapport_Journalier_${date}.xlsx`)
    }

    if (type === 'rapport_mensuel') {
      const reports: RapportJournalierData[] = []
      for (const d of daysBetween(start, end)) reports.push(await buildDailyReport(d))
      return xlsxResponse(await fillRapportJournalierMensuel(reports), `Rapport_Journalier_Mensuel_${fileMonth(yearMonth)}.xlsx`)
    }

    if (type === 'stock_ventes') {
      return xlsxResponse(await buildStockVentesRows(start, end).then(rows => fillStockEtVentes(rows, yearMonth)), `STOCK_ET_VENTES_${fileMonth(yearMonth)}.xlsx`)
    }

    if (type === 'recap') {
      const yearStart = `${year}-01-01`
      const yearEnd = `${year}-12-31`
      return xlsxResponse(await buildRecapRows(yearStart, yearEnd).then(rows => fillRecap(rows, year)), `RECAP_${year}.xlsx`)
    }

    if (type === 'zip') {
      const zip = new JSZip()
      const [
        appros,
        afriquia,
        tissir,
        vivo,
        teDimagaz,
        suiviDimagaz,
        daily,
        monthly,
        stock,
        recap,
      ] = await Promise.all([
        prisma.approvisionnement.findMany({ where: { date_br: { gte: start, lte: end } }, orderBy: [{ date_br: 'asc' }, { id: 'asc' }] }).then(d => fillApprovisionnements(d, yearMonth)),
        getVentes(start, end, ['AFRIQUIA GAZ']).then(d => fillVenteAfriquia(d, yearMonth)),
        getVentes(start, end, ['TISSIR', 'TPZ']).then(d => fillVenteTissir(d, yearMonth)),
        getVentes(start, end, ['VIVO ENERGY']).then(d => fillVenteVivo(d, yearMonth)),
        getVentes(start, end, ['TOTAL GAZ', 'TOTALENERGIES', 'SAADA', 'DIMAGAZ']).then(d => fillVenteTEDimagaz(d, yearMonth)),
        getVentes(start, end, ['DIMAGAZ']).then(d => fillSuiviDimagaz(d, yearMonth)),
        buildDailyReport(date).then(fillRapportJournalier),
        Promise.all(daysBetween(start, end).map(buildDailyReport)).then(fillRapportJournalierMensuel),
        buildStockVentesRows(start, end).then(rows => fillStockEtVentes(rows, yearMonth)),
        buildRecapRows(`${year}-01-01`, `${year}-12-31`).then(rows => fillRecap(rows, year)),
      ])

      zip.file(`01_Rapport_Journalier_${date}.xlsx`, daily)
      zip.file(`02_Rapport_Journalier_Mensuel_${fileMonth(yearMonth)}.xlsx`, monthly)
      zip.file(`03_APPROVISIONNEMENTS_${fileMonth(yearMonth)}.xlsx`, appros)
      zip.file(`04_RECAP_${year}.xlsx`, recap)
      zip.file(`05_STOCK_ET_VENTES_${fileMonth(yearMonth)}.xlsx`, stock)
      zip.file(`06_VENTE_AFRIQUIA_${fileMonth(yearMonth)}.xlsx`, afriquia)
      zip.file(`07_VENTE_TISSIR_${fileMonth(yearMonth)}.xlsx`, tissir)
      zip.file(`08_VENTE_VIVO_${fileMonth(yearMonth)}.xlsx`, vivo)
      zip.file(`09_VENTE_TOTALENERGIES_DIMAGAZ_${fileMonth(yearMonth)}.xlsx`, teDimagaz)
      zip.file(`10_SUIVI_DIMAGAZ_${fileMonth(yearMonth)}.xlsx`, suiviDimagaz)
      const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
      return new NextResponse(new Uint8Array(zipBuf), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="OUARGAZ_EXPORTS_${fileMonth(yearMonth)}.zip"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    return NextResponse.json({ error: "Type d'export invalide" }, { status: 400 })
  } catch (err) {
    console.error('Export error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur export' }, { status: 500 })
  }
}

function calcVentesKg(vs: Awaited<ReturnType<typeof prisma.venteClient.findMany>>) {
  return vs.reduce((s, v) => s + (v.poids_kg || (v.qte_12kg * 12 + v.qte_6kg * 6 + v.qte_3kg * 3 + v.qte_34kg * 34)), 0)
}

async function buildStockVentesRows(start: string, end: string) {
  const rows: Array<{ date: string; stockVracFinT: number; ventesT: number; citernes: number }> = []
  for (const d of daysBetween(start, end)) {
    const [jaugeages, ventes, citernes] = await Promise.all([
      prisma.jaugeage.findMany({ where: { date: d } }),
      prisma.venteClient.findMany({ where: { date: d } }),
      prisma.approvisionnement.count({ where: { date_br: d } }),
    ])
    rows.push({
      date: d,
      stockVracFinT: jaugeages.reduce((s, j) => s + (j.tonnage_total || 0), 0),
      ventesT: calcVentesKg(ventes) / 1000,
      citernes,
    })
  }
  return rows
}

async function buildRecapRows(start: string, end: string) {
  const rows: Array<{ date: string; boniMaliT: number; emplissageT: number; ventesT: number; boniMaliPct: number; stockVracT: number; stockCondT: number; citernes: number }> = []
  for (const d of daysBetween(start, end)) {
    const rep = await buildDailyReport(d)
    const ventesKg = sumLivKg(rep)
    const emplissageKg = computeEmplissageKg(rep)
    const stockPhysiqueKg = rep.finVracKg + rep.finCondKg
    const boniMaliKg = stockPhysiqueKg - rep.stockComptableFin
    const boniMaliPct = emplissageKg !== 0 ? (boniMaliKg / emplissageKg) * 100 : 0
    const citernes = await prisma.approvisionnement.count({ where: { date_br: d } })
    rows.push({
      date: d,
      boniMaliT: boniMaliKg / 1000,
      emplissageT: emplissageKg / 1000,
      ventesT: ventesKg / 1000,
      boniMaliPct,
      stockVracT: rep.finVracKg / 1000,
      stockCondT: rep.finCondKg / 1000,
      citernes,
    })
  }
  return rows
}

function sumLivKg(rep: RapportJournalierData) {
  return Object.values(rep.liv).reduce((s, v) => s + v.n12 * 12 + v.n3 * 3 + v.n6 * 6, 0)
}

function computeEmplissageKg(rep: RapportJournalierData) {
  const liv = Object.values(rep.liv).reduce((acc, v) => {
    acc.n12 += v.n12
    acc.n3 += v.n3
    acc.n6 += v.n6
    return acc
  }, { n12: 0, n3: 0, n6: 0 })
  const e12 = rep.finNbre12 + liv.n12 - rep.debutNbre12
  const e3 = rep.finNbre3 + liv.n3 - rep.debutNbre3
  const e6 = rep.finNbre6 + liv.n6 - rep.debutNbre6
  return e12 * 12 + e3 * 3 + e6 * 6
}

async function buildDailyReport(date: string): Promise<RapportJournalierData> {
  const yearMonth = date.slice(0, 7)
  const monthStart = `${yearMonth}-01`
  const [stockDebut, jaugeages, ventes, stocks, appros, cumulAppro] = await Promise.all([
    getStockDebut(date),
    prisma.jaugeage.findMany({ where: { date } }),
    prisma.venteClient.findMany({ where: { date } }),
    prisma.stockBouteilles.findMany({ where: { date } }),
    prisma.approvisionnement.findMany({ where: { date_br: date } }),
    prisma.approvisionnement.findMany({ where: { date_br: { gte: monthStart, lte: date } } }),
  ])

  const byProv = (rows: typeof appros, names: string[]) => rows.filter(a => names.includes((a.provenance || '').toUpperCase())).reduce((s, a) => s + a.q_bl, 0)
  const approGazber = byProv(appros, ['GAZBER', 'SAMIR'])
  const approSomas = byProv(appros, ['SOMAS'])
  const approSomasLiv = byProv(appros, ['SOMAS LIV', 'SOMAS LIV.'])
  const approDegazage = byProv(appros, ['DEGAZA', 'DEGAZAGE', 'DÉGAZAGE'])
  const approKg = appros.reduce((s, a) => s + a.q_bl, 0)
  const approCumulGazber = byProv(cumulAppro, ['GAZBER', 'SAMIR'])
  const approCumulSomas = byProv(cumulAppro, ['SOMAS'])
  const approCumulSomasLiv = byProv(cumulAppro, ['SOMAS LIV', 'SOMAS LIV.'])
  const approCumulDegazage = byProv(cumulAppro, ['DEGAZA', 'DEGAZAGE', 'DÉGAZAGE'])
  const approCumulMois = cumulAppro.reduce((s, a) => s + a.q_bl, 0)

  const sum = (vs: typeof ventes, field: 'qte_12kg' | 'qte_3kg' | 'qte_6kg') => vs.reduce((s, v) => s + (v[field] || 0), 0)
  const byMarque = (names: string[]) => ventes.filter(v => names.includes(v.marque))
  const livOf = (names: string[]) => {
    const vs = byMarque(names)
    return { n12: sum(vs, 'qte_12kg'), n3: sum(vs, 'qte_3kg'), n6: sum(vs, 'qte_6kg') }
  }

  const prevStocks = stockDebut.condRows || []
  const prevNbre = (f: 'pleines_12kg' | 'pleines_3kg' | 'pleines_6kg') => prevStocks.reduce((s, st) => s + (st[f] || 0), 0)
  const finNbre = (f: 'pleines_12kg' | 'pleines_3kg' | 'pleines_6kg') => stocks.reduce((s, st) => s + (st[f] || 0), 0)
  const finVracKg = jaugeages.reduce((s, j) => s + (j.tonnage_total || 0), 0) * 1000
  const finCondKg = stocks.reduce((s, st) => s + (st.stock_cond_kg || 0), 0)
  const ventesKg = calcVentesKg(ventes)
  const stockComptableFin = (stockDebut.vracDebutKg + stockDebut.condDebutKg) + approKg - ventesKg

  return {
    date,
    approGazber,
    approSomas,
    approSomasLiv,
    approDegazage,
    approKg,
    approCumulGazber,
    approCumulSomas,
    approCumulSomasLiv,
    approCumulDegazage,
    approCumulMois,
    debutNbre12: prevNbre('pleines_12kg'),
    debutNbre3: prevNbre('pleines_3kg'),
    debutNbre6: prevNbre('pleines_6kg'),
    debutCondKg: stockDebut.condDebutKg,
    debutVracKg: stockDebut.vracDebutKg,
    liv: {
      TOTAL: livOf(['TOTAL GAZ', 'TOTALENERGIES']),
      AFRIQUIA: livOf(['AFRIQUIA GAZ']),
      TPZ: livOf(['TISSIR', 'TPZ']),
      VIVO: livOf(['VIVO ENERGY']),
      DIMAGAZ: livOf(['DIMAGAZ', 'SAADA']),
    },
    finNbre12: finNbre('pleines_12kg'),
    finNbre3: finNbre('pleines_3kg'),
    finNbre6: finNbre('pleines_6kg'),
    finCondKg,
    finVracKg,
    stockComptableFin,
  }
}
