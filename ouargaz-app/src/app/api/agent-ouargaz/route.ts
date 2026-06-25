import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDailyMatterBalance } from '@/lib/business'
import { getSessionFromRequest } from '@/lib/auth'
import { OUARGAZ_THRESHOLDS, OUARGAZ_THRESHOLD_TEXT } from '@/lib/agent-config'

export const dynamic = 'force-dynamic'

type Period = { start: string; end: string; label: string; type: 'day' | 'month' | 'year' }
type AgentData = Array<{ label: string; value: string | number }>

const MONTHS: Record<string, string> = {
  janvier: '01', fevrier: '02', février: '02', mars: '03', avril: '04', mai: '05', juin: '06', juillet: '07', aout: '08', août: '08', septembre: '09', octobre: '10', novembre: '11', decembre: '12', décembre: '12',
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function normalize(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function parsePeriod(raw: string, fallbackDate?: string): Period {
  const q = normalize(raw)
  const base = fallbackDate && /^20\d{2}-\d{2}-\d{2}$/.test(fallbackDate) ? fallbackDate : todayISO()
  const y = base.slice(0, 4)
  const m = base.slice(5, 7)

  const iso = q.match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/)
  if (iso) {
    const date = `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
    return { start: date, end: date, label: `journée du ${date}`, type: 'day' }
  }

  const frDate = q.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})/)
  if (frDate) {
    const date = `${frDate[3]}-${frDate[2].padStart(2, '0')}-${frDate[1].padStart(2, '0')}`
    return { start: date, end: date, label: `journée du ${date}`, type: 'day' }
  }

  const monthYear = q.match(/(?:mois|en|du|de)?\s*(\d{1,2})[\/\-](20\d{2})/)
  if (monthYear) {
    const mm = monthYear[1].padStart(2, '0')
    const yy = Number(monthYear[2])
    return { start: `${yy}-${mm}-01`, end: `${yy}-${mm}-${String(daysInMonth(yy, Number(mm))).padStart(2, '0')}`, label: `${mm}/${yy}`, type: 'month' }
  }

  const moisNumero = q.match(/mois\s*(\d{1,2})(?:\s|$)/)
  if (moisNumero) {
    const mm = moisNumero[1].padStart(2, '0')
    const yy = Number((q.match(/20\d{2}/) || [y])[0])
    return { start: `${yy}-${mm}-01`, end: `${yy}-${mm}-${String(daysInMonth(yy, Number(mm))).padStart(2, '0')}`, label: `${mm}/${yy}`, type: 'month' }
  }

  for (const [name, mm] of Object.entries(MONTHS)) {
    if (q.includes(name.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
      const yearMatch = q.match(/20\d{2}/)
      const yy = yearMatch ? Number(yearMatch[0]) : Number(y)
      return { start: `${yy}-${mm}-01`, end: `${yy}-${mm}-${String(daysInMonth(yy, Number(mm))).padStart(2, '0')}`, label: `${name} ${yy}`, type: 'month' }
    }
  }

  const yearOnly = q.match(/(?:annee|en)\s*(20\d{2})/)
  if (yearOnly) return { start: `${yearOnly[1]}-01-01`, end: `${yearOnly[1]}-12-31`, label: `année ${yearOnly[1]}`, type: 'year' }

  if (q.includes('mois courant') || q.includes('ce mois') || q.includes('du mois') || q === 'mois') {
    return { start: `${y}-${m}-01`, end: `${y}-${m}-${String(daysInMonth(Number(y), Number(m))).padStart(2, '0')}`, label: `mois courant ${m}/${y}`, type: 'month' }
  }
  if (q.includes('annee courante') || q.includes('cette annee')) return { start: `${y}-01-01`, end: `${y}-12-31`, label: `année courante ${y}`, type: 'year' }

  return { start: base, end: base, label: `journée du ${base}`, type: 'day' }
}

function inPeriod(p: Period) {
  return p.start === p.end ? { equals: p.start } : { gte: p.start, lte: p.end }
}

function fmt(n: number | null | undefined, unit = '') {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return 'donnée non disponible'
  const value = Number(n).toLocaleString('fr-MA', { maximumFractionDigits: 3 })
  return unit ? `${value} ${unit}` : value
}

function listLines(items: string[]) {
  return items.length ? items.map(x => `• ${x}`).join('\n') : 'donnée non disponible'
}

function containsAny(q: string, words: string[]) {
  return words.some(w => q.includes(w))
}

async function getActiveReferentials() {
  const [clients, marques, provenances, transporteurs] = await Promise.all([
    prisma.client.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.marque.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.provenance.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.transporteur.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ])
  return { clients, marques, provenances, transporteurs }
}

async function findClientInQuestion(q: string) {
  const clients = await prisma.client.findMany({ where: { active: true }, orderBy: { name: 'asc' } })
  const nq = normalize(q)
  return clients.find(c => nq.includes(normalize(c.name))) || null
}

async function findMarqueInQuestion(q: string) {
  const marques = await prisma.marque.findMany({ where: { active: true }, orderBy: { name: 'asc' } })
  const nq = normalize(q)
  return marques.find(m => nq.includes(normalize(m.name)) || nq.includes(normalize(m.name.replace(/\s+gaz$/i, '')))) || null
}

async function answerReferentiel(q: string): Promise<{ answer: string; data: AgentData } | null> {
  const refs = await getActiveReferentials()
  const wantsList = containsAny(q, ['liste', 'quelles', 'quels', 'noms', 'affiche'])
  const wantsCount = containsAny(q, ['combien', 'nombre', 'total'])

  const isClientRef = q.includes('client') && !containsAny(q, ['servi', 'servis', 'vente', 'vendu', 'realise', 'realise', 'realisé', 'top', 'meilleur'])
  if (isClientRef) {
    const marque = await findMarqueInQuestion(q)
    const clients = marque ? refs.clients.filter(c => normalize(c.marque) === normalize(marque.name)) : refs.clients
    const grouped = refs.marques.map(m => ({ marque: m.name, count: refs.clients.filter(c => normalize(c.marque) === normalize(m.name)).length })).filter(x => x.count > 0)
    if (wantsList || q.includes('liste')) {
      return {
        answer: marque
          ? `Clients ${marque.name} enregistrés (${clients.length}) :\n${listLines(clients.map(c => c.name))}`
          : `Clients enregistrés à OUARGAZ (${clients.length}) :\n${listLines(clients.map(c => `${c.name} — ${c.marque}`))}`,
        data: clients.map(c => ({ label: c.name, value: c.marque })),
      }
    }
    if (marque) return { answer: `Nombre de clients ${marque.name} enregistrés : ${clients.length}.`, data: [{ label: `Clients ${marque.name}`, value: clients.length }] }
    return {
      answer: `Nombre total de clients enregistrés à OUARGAZ : ${refs.clients.length}.\n` + grouped.map(g => `${g.marque} : ${g.count}`).join('\n'),
      data: [{ label: 'Total clients', value: refs.clients.length }, ...grouped.map(g => ({ label: g.marque, value: g.count }))],
    }
  }

  if (q.includes('marque') || q.includes('societe') || q.includes('société')) {
    if (wantsList || wantsCount || q.includes('quelles') || q.includes('combien')) {
      return {
        answer: `Marques / sociétés enregistrées (${refs.marques.length}) :\n${listLines(refs.marques.map(m => m.name))}`,
        data: refs.marques.map(m => ({ label: m.name, value: 'active' })),
      }
    }
  }

  if (q.includes('provenance') || q.includes('somas') || q.includes('gazber') || q.includes('degaza') || q.includes('samir')) {
    return {
      answer: `Provenances enregistrées (${refs.provenances.length}) :\n${listLines(refs.provenances.map(p => p.name))}`,
      data: refs.provenances.map(p => ({ label: p.name, value: 'active' })),
    }
  }

  if (q.includes('transporteur') || q.includes('transporteurs')) {
    return {
      answer: `Transporteurs enregistrés (${refs.transporteurs.length}) :\n${listLines(refs.transporteurs.map(t => t.name))}`,
      data: refs.transporteurs.map(t => ({ label: t.name, value: 'active' })),
    }
  }

  return null
}

function answerThresholds(q: string): { answer: string; data: AgentData } | null {
  const isThreshold = containsAny(q, ['seuil', 'alerte', 'critique', 'normal'])
  if (!isThreshold && !q.includes('stock critique')) return null

  if (q.includes('vrac') || q.includes('stock') || q.includes('critique')) {
    return {
      answer: `Seuil stock VRAC : ${OUARGAZ_THRESHOLD_TEXT.stockVrac}`,
      data: [{ label: 'Seuil VRAC critique', value: `${OUARGAZ_THRESHOLDS.stockVracCriticalT} T` }],
    }
  }
  if (q.includes('boni') || q.includes('mali')) {
    return {
      answer: `Seuil Boni/Mali : ${OUARGAZ_THRESHOLD_TEXT.boniMali}`,
      data: [{ label: 'Seuil Boni/Mali', value: `${OUARGAZ_THRESHOLDS.boniMaliPctLimit} %` }],
    }
  }
  return {
    answer: `Seuils système OUARGAZ :\n- ${OUARGAZ_THRESHOLD_TEXT.stockVrac}\n- ${OUARGAZ_THRESHOLD_TEXT.boniMali}`,
    data: [
      { label: 'VRAC critique', value: `${OUARGAZ_THRESHOLDS.stockVracCriticalT} T` },
      { label: 'Boni/Mali', value: `${OUARGAZ_THRESHOLDS.boniMaliPctLimit} %` },
    ],
  }
}

async function ventesForPeriod(p: Period, client?: string, marque?: string) {
  const rows = await prisma.venteClient.findMany({ where: { date: inPeriod(p), ...(client ? { client } : {}), ...(marque ? { marque } : {}) } })
  return {
    rows,
    kg: rows.reduce((s, r) => s + (r.poids_kg || 0), 0),
    t: rows.reduce((s, r) => s + (r.poids_t || 0), 0),
    q12: rows.reduce((s, r) => s + (r.qte_12kg || 0), 0),
    q3: rows.reduce((s, r) => s + (r.qte_3kg || 0), 0),
    q6: rows.reduce((s, r) => s + (r.qte_6kg || 0), 0),
    q34: rows.reduce((s, r) => s + (r.qte_34kg || 0), 0),
  }
}

function datesBetween(start: string, end: string) {
  const out: string[] = []
  const d = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  while (d <= e) { out.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1) }
  return out
}

async function answerOperational(question: string, fallbackDate?: string) {
  const q = normalize(question)
  const p = parsePeriod(q, fallbackDate)
  const client = await findClientInQuestion(q)
  const marque = await findMarqueInQuestion(q)

  if (q.includes('aide') || q.includes('exemple')) {
    return { answer: 'Exemples : combien de clients à OUARGAZ ? liste des marques ? seuil VRAC ? ventes du mois ? top clients du mois ? combien a réalisé ABOUDRAR en juin 2026 ? nombre de citernes ce mois ? jaugeage C1 aujourd’hui ?', data: [] }
  }

  if (q.includes('top') || q.includes('meilleur')) {
    const rows = await prisma.venteClient.findMany({ where: { date: inPeriod(p) } })
    if (!rows.length) return { answer: `Donnée non disponible pour cette période (${p.label}).`, data: [] }
    const byClient = new Map<string, number>()
    for (const r of rows) byClient.set(r.client, (byClient.get(r.client) || 0) + (r.poids_t || 0))
    const top = Array.from(byClient.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)
    return { answer: `Top clients pour ${p.label} :\n${top.map((x, i) => `${i + 1}. ${x[0]} — ${fmt(x[1], 'T')}`).join('\n')}`, data: top.map((x, i) => ({ label: `${i + 1}. ${x[0]}`, value: fmt(x[1], 'T') })) }
  }

  if (q.includes('client') && containsAny(q, ['servi', 'servis', 'nombre', 'combien']) && !containsAny(q, ['enregistre', 'enregistres', 'ouargaz'])) {
    const rows = await prisma.venteClient.findMany({ where: { date: inPeriod(p) }, select: { client: true } })
    if (!rows.length) return { answer: `Donnée non disponible pour cette période (${p.label}).`, data: [] }
    const count = new Set(rows.map(r => r.client)).size
    return { answer: `Nombre de clients servis pour ${p.label} : ${count}.`, data: [{ label: 'Clients servis', value: count }] }
  }

  if (q.includes('vente') || q.includes('realise') || q.includes('realisé') || q.includes('réalisé') || q.includes('vendu') || client || marque) {
    if (q.includes('par marque') || (q.includes('marque') && !marque)) {
      const rows = await prisma.venteClient.findMany({ where: { date: inPeriod(p) } })
      if (!rows.length) return { answer: `Donnée non disponible pour cette période (${p.label}).`, data: [] }
      const byMarque = new Map<string, number>()
      for (const r of rows) byMarque.set(r.marque, (byMarque.get(r.marque) || 0) + (r.poids_t || 0))
      const sorted = Array.from(byMarque.entries()).sort((a, b) => b[1] - a[1])
      return { answer: `Ventes par marque pour ${p.label} :\n${sorted.map(([m, t]) => `${m} : ${fmt(t, 'T')}`).join('\n')}`, data: sorted.map(([m, t]) => ({ label: m, value: fmt(t, 'T') })) }
    }
    const v = await ventesForPeriod(p, client?.name, marque?.name)
    if (!v.rows.length) return { answer: `Donnée non disponible pour cette période (${p.label}).`, data: [] }
    const cible = client ? ` du client ${client.name}` : marque ? ` de la marque ${marque.name}` : ''
    return { answer: `Ventes${cible} pour ${p.label} : ${fmt(v.t, 'T')} (${fmt(v.kg, 'kg')}). Détail : 12 kg = ${fmt(v.q12)}, 3 kg = ${fmt(v.q3)}, 6 kg = ${fmt(v.q6)}, 34 kg = ${fmt(v.q34)}.`, data: [{ label: 'Tonnage', value: fmt(v.t, 'T') }, { label: 'Poids', value: fmt(v.kg, 'kg') }, { label: '12 kg', value: v.q12 }, { label: '3 kg', value: v.q3 }, { label: '6 kg', value: v.q6 }] }
  }

  if (q.includes('appro') || q.includes('citerne') || q.includes('reception') || q.includes('réception')) {
    const rows = await prisma.approvisionnement.findMany({ where: { date_br: inPeriod(p) } })
    if (!rows.length) return { answer: `Donnée non disponible pour cette période (${p.label}).`, data: [] }
    if (q.includes('provenance')) {
      const byProv = new Map<string, { qnet: number; ecart: number; count: number }>()
      for (const r of rows) {
        const key = r.provenance || 'Non renseignée'
        const cur = byProv.get(key) || { qnet: 0, ecart: 0, count: 0 }
        cur.qnet += r.q_net || 0; cur.ecart += r.ecart || 0; cur.count += 1; byProv.set(key, cur)
      }
      const sorted = Array.from(byProv.entries()).sort((a, b) => b[1].qnet - a[1].qnet)
      return { answer: `Approvisionnement par provenance pour ${p.label} :\n${sorted.map(([prov, v]) => `${prov} : ${v.count} citerne(s), ${fmt(v.qnet, 'kg')} (${fmt(v.qnet / 1000, 'T')}), écart ${fmt(v.ecart, 'kg')}`).join('\n')}`, data: sorted.map(([prov, v]) => ({ label: prov, value: fmt(v.qnet / 1000, 'T') })) }
    }
    const qnet = rows.reduce((s, r) => s + (r.q_net || 0), 0)
    const qbl = rows.reduce((s, r) => s + (r.q_bl || 0), 0)
    const ecart = rows.reduce((s, r) => s + (r.ecart || 0), 0)
    return { answer: `Approvisionnements pour ${p.label} : ${rows.length} citerne(s), Q_net = ${fmt(qnet, 'kg')} (${fmt(qnet / 1000, 'T')}), Q_BL = ${fmt(qbl, 'kg')}, écart = ${fmt(ecart, 'kg')}.`, data: [{ label: 'Citernes', value: rows.length }, { label: 'Q_net', value: fmt(qnet, 'kg') }, { label: 'Écart', value: fmt(ecart, 'kg') }] }
  }

  if (q.includes('boni') || q.includes('mali')) {
    if (p.type === 'day') {
      const b = await getDailyMatterBalance(p.start)
      const hasData = b.jaugeages.length || b.stocks.length || b.ventes.length || b.appros.length
      if (!hasData) return { answer: `Donnée non disponible pour cette période (${p.label}).`, data: [] }
      return { answer: `Boni/Mali pour ${p.label} : ${fmt(b.boniMaliT, 'T')} (${fmt(b.boniMaliKg, 'kg')}), soit ${fmt(b.boniMaliPct, '%')}. Stock comptable : ${fmt(b.stockComptableT, 'T')}. Stock physique : ${fmt(b.stockTotalT, 'T')}.`, data: [{ label: 'Boni/Mali', value: fmt(b.boniMaliT, 'T') }, { label: 'Boni/Mali %', value: fmt(b.boniMaliPct, '%') }] }
    }
    const balances = await Promise.all(datesBetween(p.start, p.end).map(d => getDailyMatterBalance(d)))
    const valid = balances.filter(b => b.jaugeages.length || b.stocks.length || b.ventes.length || b.appros.length)
    if (!valid.length) return { answer: `Donnée non disponible pour cette période (${p.label}).`, data: [] }
    const boniT = valid.reduce((s, b) => s + b.boniMaliT, 0)
    const ventesT = valid.reduce((s, b) => s + b.ventesT, 0)
    const pct = ventesT > 0 ? (boniT / ventesT) * 100 : 0
    return { answer: `Boni/Mali cumulé pour ${p.label} : ${fmt(boniT, 'T')} (${fmt(boniT * 1000, 'kg')}), soit ${fmt(pct, '%')} sur ${valid.length} journée(s) avec données.`, data: [{ label: 'Boni/Mali cumulé', value: fmt(boniT, 'T') }, { label: 'Boni/Mali %', value: fmt(pct, '%') }] }
  }

  if (q.includes('stock') || q.includes('vrac') || q.includes('condition') || q.includes('jauge') || q.includes('reservoir') || q.includes('réservoir') || /\bc[1-5]\b/.test(q)) {
    const b = await getDailyMatterBalance(p.start)
    const reservoirMatch = q.match(/\bc([1-5])\b/)
    if (q.includes('jauge') || q.includes('reservoir') || q.includes('réservoir') || reservoirMatch) {
      if (!b.jaugeages.length) return { answer: `Donnée non disponible pour cette période (${p.label}).`, data: [] }
      if (reservoirMatch) {
        const key = `C${reservoirMatch[1]}`
        const j = b.jaugeages.find(x => normalize(x.reservoir) === normalize(key))
        if (!j) return { answer: `Donnée non disponible pour ${key} sur ${p.label}.`, data: [] }
        return { answer: `${key} pour ${p.label} : ${fmt(j.tonnage_total, 'T')}, niveau ${fmt(j.niveau_mm, 'mm')}, température ${fmt(j.temperature, '°C')}, pression ${fmt(j.pression, 'bar')}, remplissage ${fmt(j.remplissage_pct, '%')}.`, data: [{ label: key, value: fmt(j.tonnage_total, 'T') }, { label: 'Niveau', value: fmt(j.niveau_mm, 'mm') }, { label: 'Température', value: fmt(j.temperature, '°C') }, { label: 'Pression', value: fmt(j.pression, 'bar') }] }
      }
      return { answer: `Jaugeage pour ${p.label} :\n${b.jaugeages.map(j => `${j.reservoir} : ${fmt(j.tonnage_total, 'T')}, niveau ${fmt(j.niveau_mm, 'mm')}, T ${fmt(j.temperature, '°C')}, P ${fmt(j.pression, 'bar')}`).join('\n')}\nStock VRAC total : ${fmt(b.stockVracT, 'T')}.`, data: b.jaugeages.map(j => ({ label: j.reservoir, value: fmt(j.tonnage_total, 'T') })) }
    }
    if (!b.jaugeages.length && !b.stocks.length) return { answer: `Donnée non disponible pour cette période (${p.label}).`, data: [] }
    return { answer: `Stock pour ${p.label} : VRAC = ${fmt(b.stockVracT, 'T')}, conditionné = ${fmt(b.stockCondT, 'T')}, total GPL = ${fmt(b.stockTotalT, 'T')}. Stock début total utilisé = ${fmt(b.stockDebutTotalT, 'T')}.`, data: [{ label: 'VRAC', value: fmt(b.stockVracT, 'T') }, { label: 'Conditionné', value: fmt(b.stockCondT, 'T') }, { label: 'Total GPL', value: fmt(b.stockTotalT, 'T') }] }
  }

  return { answer: 'Je n’ai pas trouvé de réponse sûre dans les données enregistrées. Reformulez avec un thème : référentiels, seuils, ventes, client, marque, stock, jaugeage, approvisionnement, boni/mali.', data: [] }
}

async function answerQuestion(question: string, fallbackDate?: string) {
  const q = normalize(question)
  if (!q) return { answer: 'Posez une question métier sur les référentiels, seuils, ventes, stocks, jauges, approvisionnements ou boni/mali.', data: [] }

  const referentiel = await answerReferentiel(q)
  if (referentiel) return referentiel

  const thresholds = answerThresholds(q)
  if (thresholds) return thresholds

  return answerOperational(question, fallbackDate)
}

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => ({ question: '' }))
  try {
    const result = await answerQuestion(String(body.question || ''), body.selectedDate ? String(body.selectedDate) : undefined)
    return NextResponse.json({ ...result, source: 'Base de données OUARGAZ', generatedAt: new Date().toISOString() })
  } catch (e: any) {
    return NextResponse.json({ answer: `Donnée non disponible : impossible d’interroger la base (${e?.message || 'erreur inconnue'}).`, data: [] })
  }
}
