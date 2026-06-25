import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { STATUTS, tonnagePleines, tonnageDefectueuses, taux, totalEntreesBouteilles, totalSortiesBouteilles, tonnageSorti } from '@/lib/camions'

function sum(rows:any[], key:string){ return rows.reduce((s,r)=>s+(r[key]||0),0) }
function avg(rows:any[], fn:(r:any)=>number){ const vals=rows.map(fn).filter(v=>Number.isFinite(v) && v>=0); return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0 }
function hours(a?:Date|string|null,b?:Date|string|null){ if(!a||!b) return 0; return (new Date(b).getTime()-new Date(a).getTime())/36e5 }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || new Date().toISOString().slice(0,10)
  const month = date.slice(0,7)
  const day = await prisma.camionDepositaire.findMany({ where: { date } })
  const monthRows = await prisma.camionDepositaire.findMany({ where: { date: { startsWith: month } } })
  const counts = (rows:any[]) => ({
    arrives: rows.filter(r => r.statut !== STATUTS.ANNULE).length,
    attente: rows.filter(r => r.statut === STATUTS.EN_ATTENTE).length,
    internes: rows.filter(r => [STATUTS.EN_COURS_TRAITEMENT, STATUTS.DEMARRAGE_EMPLISSAGE].includes(r.statut)).length,
    traitement: rows.filter(r => r.statut === STATUTS.EN_COURS_TRAITEMENT).length,
    emplissage: rows.filter(r => r.statut === STATUTS.DEMARRAGE_EMPLISSAGE).length,
    prets: rows.filter(r => r.statut === STATUTS.PRET_A_SORTIR).length,
    sortis: rows.filter(r => r.statut === STATUTS.SORTI).length,
    annules: rows.filter(r => r.statut === STATUTS.ANNULE).length,
  })
  const aggregate = (rows:any[]) => {
    const out = rows.filter(r => r.statut === STATUTS.SORTI)
    const entreesTotal = rows.reduce((s,r)=>s+totalEntreesBouteilles(r),0)
    const sortiesTotal = out.reduce((s,r)=>s+totalSortiesBouteilles(r),0)
    const sorties12 = sum(out,'sortie_12kg'), sorties6 = sum(out,'sortie_6kg'), sorties3 = sum(out,'sortie_3kg')
    const vides12 = sum(rows,'vides_12kg'), vides6 = sum(rows,'vides_6kg'), vides3 = sum(rows,'vides_3kg')
    const etr12 = sum(rows,'etrangeres_12kg'), etr6 = sum(rows,'etrangeres_6kg'), etr3 = sum(rows,'etrangeres_3kg')
    const sortVides12=sum(out,'sortie_vides_12kg'), sortVides6=sum(out,'sortie_vides_6kg'), sortVides3=sum(out,'sortie_vides_3kg')
    const sortEtr12=sum(out,'sortie_etr_12kg'), sortEtr6=sum(out,'sortie_etr_6kg'), sortEtr3=sum(out,'sortie_etr_3kg')
    const rendues12 = sum(rows,'def_rendues_12kg'), rendues6 = sum(rows,'def_rendues_6kg'), rendues3 = sum(rows,'def_rendues_3kg')
    const remp12 = sum(rows,'def_acceptees_12kg'), remp6 = sum(rows,'def_acceptees_6kg'), remp3 = sum(rows,'def_acceptees_3kg')
    const refus12 = sum(rows,'def_refusees_12kg'), refus6 = sum(rows,'def_refusees_6kg'), refus3 = sum(rows,'def_refusees_3kg')
    const tonnage12 = sorties12 * 12 / 1000, tonnage6 = sorties6 * 6 / 1000, tonnage3 = sorties3 * 3 / 1000
    const defRenduesT = tonnageDefectueuses(rendues12, rendues6, rendues3)
    const defRemplaceesT = tonnageDefectueuses(remp12, remp6, remp3)
    const tonnageSortiTotal = out.reduce((s,r)=>s+tonnageSorti(r),0)
    return { sorties12, sorties6, sorties3, tonnage12, tonnage6, tonnage3, tonnageTotal: tonnage12+tonnage6+tonnage3, tonnageSortiTotal,
      entreesTotal, sortiesTotal, ecartBouteilles: sortiesTotal - entreesTotal,
      vides12, vides6, vides3, sortVides12, sortVides6, sortVides3,
      etr12, etr6, etr3, sortEtr12, sortEtr6, sortEtr3,
      rendues12, rendues6, rendues3, remp12, remp6, remp3, refus12, refus6, refus3,
      defRenduesT, defRemplaceesT, taux12: taux(remp12,rendues12), taux6: taux(remp6,rendues6), taux3: taux(remp3,rendues3), tauxGlobal: taux(remp12+remp6+remp3, rendues12+rendues6+rendues3),
      tempsAttenteH: avg(out, r=>hours(r.arriveeAt,r.entreeAt)), tempsTraitementH: avg(out, r=>hours(r.entreeAt,r.finChargementAt)), tempsSejourH: avg(out, r=>hours(r.arriveeAt,r.sortieAt)),
    }
  }
  const ventesRapport = await prisma.venteClient.findMany({ where: { date } })
  const ventesRapportT = ventesRapport.reduce((s, v) => s + (v.poids_t || 0), 0)
  const aDay = aggregate(day)
  return NextResponse.json({ date, dayCounts: counts(day), monthCounts: counts(monthRows), day: aDay, month: aggregate(monthRows), ventesRapportT, ecartVentesT: aDay.tonnageSortiTotal - ventesRapportT })
}
