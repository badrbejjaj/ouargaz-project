import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import ExcelJS from 'exceljs'
import { STATUT_LABELS, casiers12, casiers6, casiers3 } from '@/lib/camions'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || new Date().toISOString().slice(0,10)
  const mode = searchParams.get('mode') || 'jour' // 'jour' ou 'mois'
  const where: any = mode === 'mois' ? { date: { startsWith: date.slice(0,7) } } : { date }
  const camions = await prisma.camionDepositaire.findMany({ where, orderBy: [{ arriveeAt: 'asc' }] })

  const wb = new ExcelJS.Workbook()
  wb.creator = 'OUARGAZ APP V6.3'
  const ws = wb.addWorksheet('Mouvements Camions')

  const headers = [
    'Date','Client','Marque','Matricule','Chauffeur','N° BC','N° BL','Statut',
    'Pleine 12','Pleine 6','Pleine 3',
    'Défect. 12','Défect. 6','Défect. 3',
    'Étrangère 12','Étrangère 6','Étrangère 3',
    'Acceptées 12','Acceptées 6','Acceptées 3',
    'Refusées 12','Refusées 6','Refusées 3',
    'Sortie 12','Sortie 6','Sortie 3',
    'Sortie Étr. 12','Sortie Étr. 6','Sortie Étr. 3',
    'Casiers 12','Casiers 6','Casiers 3','Total casiers',
    'Arrivée','Entrée','Emplissage','Fin chargement','Sortie',
    'Saisi par','Traité par','Sorti par',
  ]
  ws.addRow(headers)
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDA1A1A' } }

  const fdt = (d:any) => d ? new Date(d).toLocaleString('fr-MA') : ''

  for (const c of camions) {
    const c12 = casiers12(c.saisie_12kg, c.def_rendues_12kg, c.etrangeres_12kg)
    const c6 = casiers6(c.saisie_6kg, c.def_rendues_6kg, c.etrangeres_6kg)
    const c3 = casiers3(c.saisie_3kg, c.def_rendues_3kg, c.etrangeres_3kg)
    ws.addRow([
      c.date, c.client, c.marque, c.matricule, c.chauffeur, c.numero_bc, c.numero_bl_sortie || '', STATUT_LABELS[c.statut] || c.statut,
      c.saisie_12kg, c.saisie_6kg, c.saisie_3kg,
      c.def_rendues_12kg, c.def_rendues_6kg, c.def_rendues_3kg,
      c.etrangeres_12kg, c.etrangeres_6kg, c.etrangeres_3kg,
      c.def_acceptees_12kg, c.def_acceptees_6kg, c.def_acceptees_3kg,
      c.def_refusees_12kg, c.def_refusees_6kg, c.def_refusees_3kg,
      c.sortie_12kg, c.sortie_6kg, c.sortie_3kg,
      c.sortie_etr_12kg, c.sortie_etr_6kg, c.sortie_etr_3kg,
      c12, c6, c3, c12+c6+c3,
      fdt(c.arriveeAt), fdt(c.entreeAt), fdt(c.debutEmplissageAt), fdt(c.finChargementAt), fdt(c.sortieAt),
      c.createdBy || '', c.processedBy || '', c.exitedBy || '',
    ])
  }

  ws.columns.forEach(col => { col.width = 14 })

  const buf = await wb.xlsx.writeBuffer()
  const fname = `MOUVEMENTS_CAMIONS_${mode}_${date}.xlsx`
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fname}"`,
    },
  })
}
