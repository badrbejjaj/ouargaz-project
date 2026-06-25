import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
import { STATUTS } from '@/lib/camions'
import { canManageQueue, canProcessInternal, canValidateExit } from '@/lib/roles'

function today() { return new Date().toISOString().slice(0,10) }
function n(v: unknown) { const x = Number(v); return Number.isFinite(x) ? Math.max(0, Math.trunc(x)) : 0 }
function s(v: unknown) { return String(v ?? '').trim() }

async function log(camionId: number, action: string, session: any, fromStatus?: string | null, toStatus?: string | null, details?: string, oldValue?: unknown, newValue?: unknown) {
  await prisma.camionMovementLog.create({ data: { camionId, action, fromStatus: fromStatus || undefined, toStatus: toStatus || undefined, username: session?.username || 'system', role: session?.role || 'SYSTEM', details, oldValue: oldValue ? JSON.stringify(oldValue) : undefined, newValue: newValue ? JSON.stringify(newValue) : undefined } })
}
async function notify(role: string, title: string, message: string, link='/mouvements-camions') {
  await prisma.notification.create({ data: { role, title, message, link } })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const statut = searchParams.get('statut')
  const date = searchParams.get('date')
  const includeAll = searchParams.get('all') === '1'
  const where: any = {}
  if (statut && statut !== 'TOUS') where.statut = statut
  if (date) where.date = date
  if (!includeAll && !statut) where.statut = { notIn: [STATUTS.SORTI, STATUTS.ANNULE] }
  const camions = await prisma.camionDepositaire.findMany({ where, orderBy: [{ arriveeAt: 'asc' }, { id: 'asc' }] })
  return NextResponse.json({ camions })
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!canManageQueue(session.role)) return NextResponse.json({ error: 'Seul l’agent de saisie/garde peut ajouter un camion en file d’attente' }, { status: 403 })
  const body = await req.json()
  const client = s(body.client), marque = s(body.marque), matricule = s(body.matricule), chauffeur = s(body.chauffeur), numero_bc = s(body.numero_bc)
  if (!client || !marque || !matricule || !chauffeur || !numero_bc) return NextResponse.json({ error: 'Client, marque, matricule, chauffeur et N° BC sont obligatoires' }, { status: 400 })
  // V6.4 : à l'entrée, le camion ramène VIDES + DÉFECTUEUSES + ÉTRANGÈRES. Zéro pleine à l'entrée.
  const data: any = {
    date: s(body.date) || today(), client, marque, matricule, chauffeur, numero_bc,
    saisie_12kg: 0, saisie_6kg: 0, saisie_3kg: 0,
    vides_12kg: n(body.vides_12kg), vides_6kg: n(body.vides_6kg), vides_3kg: n(body.vides_3kg),
    def_rendues_12kg: n(body.def_rendues_12kg), def_rendues_6kg: n(body.def_rendues_6kg), def_rendues_3kg: n(body.def_rendues_3kg),
    etrangeres_12kg: n(body.etrangeres_12kg), etrangeres_6kg: n(body.etrangeres_6kg), etrangeres_3kg: n(body.etrangeres_3kg),
    terrain_12kg: 0, terrain_6kg: 0, terrain_3kg: 0,
    terrain_vides_12kg: n(body.vides_12kg), terrain_vides_6kg: n(body.vides_6kg), terrain_vides_3kg: n(body.vides_3kg),
    terrain_etr_12kg: n(body.etrangeres_12kg), terrain_etr_6kg: n(body.etrangeres_6kg), terrain_etr_3kg: n(body.etrangeres_3kg),
    createdBy: session.username,
  }
  const camion = await prisma.camionDepositaire.create({ data })
  await log(camion.id, 'CREATION_FILE_ATTENTE', session, null, camion.statut, 'Camion ajouté en file d’attente V6.4 : vides + défectueuses + étrangères', null, data)
  return NextResponse.json({ camion })
}

export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const body = await req.json()
  const id = Number(body.id)
  const camion = await prisma.camionDepositaire.findUnique({ where: { id } })
  if (!camion) return NextResponse.json({ error: 'Camion introuvable' }, { status: 404 })
  const action = s(body.action)

  if (action === 'update-attente') {
    if (!canManageQueue(session.role)) return NextResponse.json({ error: 'Modification file d’attente réservée à l’agent de saisie/garde' }, { status: 403 })
    if (camion.statut !== STATUTS.EN_ATTENTE) return NextResponse.json({ error: 'Modification autorisée uniquement en file d’attente' }, { status: 400 })
    const data: any = {
      date: s(body.date) || camion.date, client: s(body.client) || camion.client, marque: s(body.marque) || camion.marque,
      matricule: s(body.matricule) || camion.matricule, chauffeur: s(body.chauffeur) || camion.chauffeur, numero_bc: s(body.numero_bc) || camion.numero_bc,
      saisie_12kg: 0, saisie_6kg: 0, saisie_3kg: 0,
      vides_12kg: n(body.vides_12kg), vides_6kg: n(body.vides_6kg), vides_3kg: n(body.vides_3kg),
      def_rendues_12kg: n(body.def_rendues_12kg), def_rendues_6kg: n(body.def_rendues_6kg), def_rendues_3kg: n(body.def_rendues_3kg),
      etrangeres_12kg: n(body.etrangeres_12kg), etrangeres_6kg: n(body.etrangeres_6kg), etrangeres_3kg: n(body.etrangeres_3kg),
      terrain_12kg: 0, terrain_6kg: 0, terrain_3kg: 0,
      terrain_vides_12kg: n(body.vides_12kg), terrain_vides_6kg: n(body.vides_6kg), terrain_vides_3kg: n(body.vides_3kg),
      terrain_etr_12kg: n(body.etrangeres_12kg), terrain_etr_6kg: n(body.etrangeres_6kg), terrain_etr_3kg: n(body.etrangeres_3kg),
    }
    const updated = await prisma.camionDepositaire.update({ where: { id }, data })
    await log(id, 'MODIFICATION_FILE_ATTENTE', session, camion.statut, camion.statut, 'Modification avant entrée V6.4', camion, updated)
    return NextResponse.json({ camion: updated })
  }

  if (action === 'annuler') {
    if (!canManageQueue(session.role)) return NextResponse.json({ error: 'Annulation réservée à l’agent de saisie/garde' }, { status: 403 })
    const motif = s(body.motif)
    if (!motif) return NextResponse.json({ error: 'Justificatif obligatoire' }, { status: 400 })
    if (camion.statut !== STATUTS.EN_ATTENTE) return NextResponse.json({ error: 'Annulation autorisée uniquement avant entrée' }, { status: 400 })
    const updated = await prisma.camionDepositaire.update({ where: { id }, data: { statut: STATUTS.ANNULE, motif_annulation: motif } })
    await log(id, 'ANNULATION_FILE_ATTENTE', session, camion.statut, STATUTS.ANNULE, motif, camion, updated)
    return NextResponse.json({ camion: updated })
  }

  if (action === 'entrer') {
    if (!canManageQueue(session.role)) return NextResponse.json({ error: 'Entrée camion réservée à l’agent de saisie/garde' }, { status: 403 })
    if (camion.statut !== STATUTS.EN_ATTENTE) return NextResponse.json({ error: 'Camion non disponible en file d’attente' }, { status: 400 })
    const updated = await prisma.camionDepositaire.update({ where: { id }, data: { statut: STATUTS.EN_COURS_TRAITEMENT, entreeAt: new Date(), enteredBy: session.username } })
    await notify('CHEF_EQUIPE', 'Nouveau camion interne', `Le camion ${camion.matricule} de ${camion.client} est entré au centre et attend traitement.`)
    await log(id, 'ENTREE_CENTRE', session, camion.statut, STATUTS.EN_COURS_TRAITEMENT, 'Camion entré au centre')
    return NextResponse.json({ camion: updated })
  }

  if (action === 'terrain') {
    if (!canProcessInternal(session.role)) return NextResponse.json({ error: 'Traitement interne réservé au chef d’équipe' }, { status: 403 })
    if (![STATUTS.EN_COURS_TRAITEMENT, STATUTS.DEMARRAGE_EMPLISSAGE].includes(camion.statut as any)) return NextResponse.json({ error: 'Camion non modifiable par chef d’équipe' }, { status: 400 })
    const data: any = {
      terrain_12kg: 0, terrain_6kg: 0, terrain_3kg: 0,
      terrain_vides_12kg: n(body.terrain_vides_12kg ?? body.vides_12kg), terrain_vides_6kg: n(body.terrain_vides_6kg ?? body.vides_6kg), terrain_vides_3kg: n(body.terrain_vides_3kg ?? body.vides_3kg),
      def_rendues_12kg: n(body.def_rendues_12kg), def_rendues_6kg: n(body.def_rendues_6kg), def_rendues_3kg: n(body.def_rendues_3kg),
      terrain_etr_12kg: n(body.terrain_etr_12kg), terrain_etr_6kg: n(body.terrain_etr_6kg), terrain_etr_3kg: n(body.terrain_etr_3kg),
      processedBy: session.username,
    }
    const updated = await prisma.camionDepositaire.update({ where: { id }, data })
    await log(id, 'VALIDATION_TERRAIN', session, camion.statut, camion.statut, 'Quantités entrée terrain validées/corrigées : vides + défectueuses + étrangères', camion, updated)
    return NextResponse.json({ camion: updated })
  }

  if (action === 'demarrer') {
    if (!canProcessInternal(session.role)) return NextResponse.json({ error: 'Démarrage chargement réservé au chef d’équipe' }, { status: 403 })
    if (camion.statut !== STATUTS.EN_COURS_TRAITEMENT) return NextResponse.json({ error: 'Le camion doit être en cours de traitement' }, { status: 400 })
    const updated = await prisma.camionDepositaire.update({ where: { id }, data: { statut: STATUTS.DEMARRAGE_EMPLISSAGE, debutEmplissageAt: new Date(), processedBy: session.username, def_traitees_12kg: camion.def_rendues_12kg, def_traitees_6kg: camion.def_rendues_6kg, def_traitees_3kg: camion.def_rendues_3kg } })
    await log(id, 'DEMARRAGE_CHARGEMENT', session, camion.statut, STATUTS.DEMARRAGE_EMPLISSAGE, 'Démarrage chargement après validation des vides/défectueuses/étrangères')
    return NextResponse.json({ camion: updated })
  }

  if (action === 'terminer') {
    if (!canProcessInternal(session.role)) return NextResponse.json({ error: 'Fin chargement réservée au chef d’équipe' }, { status: 403 })
    if (camion.statut !== STATUTS.DEMARRAGE_EMPLISSAGE) return NextResponse.json({ error: 'Le camion doit être en démarrage chargement' }, { status: 400 })
    const tr12=camion.def_traitees_12kg || camion.def_rendues_12kg, tr6=camion.def_traitees_6kg || camion.def_rendues_6kg, tr3=camion.def_traitees_3kg || camion.def_rendues_3kg
    const acc12=n(body.def_acceptees_12kg), acc6=n(body.def_acceptees_6kg), acc3=n(body.def_acceptees_3kg)
    const data: any = {
      statut: STATUTS.PRET_A_SORTIR, finChargementAt: new Date(), processedBy: session.username,
      charge_12kg: n(body.charge_12kg), charge_6kg: n(body.charge_6kg), charge_3kg: n(body.charge_3kg),
      def_traitees_12kg: tr12, def_traitees_6kg: tr6, def_traitees_3kg: tr3,
      def_acceptees_12kg: acc12, def_acceptees_6kg: acc6, def_acceptees_3kg: acc3,
      def_refusees_12kg: Math.max(0, tr12 - acc12), def_refusees_6kg: Math.max(0, tr6 - acc6), def_refusees_3kg: Math.max(0, tr3 - acc3),
      sortie_12kg: n(body.charge_12kg), sortie_6kg: n(body.charge_6kg), sortie_3kg: n(body.charge_3kg),
      sortie_vides_12kg: 0, sortie_vides_6kg: 0, sortie_vides_3kg: 0,
      sortie_etr_12kg: camion.terrain_etr_12kg, sortie_etr_6kg: camion.terrain_etr_6kg, sortie_etr_3kg: camion.terrain_etr_3kg,
    }
    const updated = await prisma.camionDepositaire.update({ where: { id }, data })
    await notify('AGENT_SAISIE', 'Camion prêt à sortir', `Le camion ${camion.matricule} de ${camion.client} est prêt à sortir.`)
    await log(id, 'CHARGEMENT_TERMINE', session, camion.statut, STATUTS.PRET_A_SORTIR, 'Chargement terminé V6.4 : pleines + défectueuses refusées + étrangères', camion, updated)
    return NextResponse.json({ camion: updated })
  }

  if (action === 'sortir') {
    if (!canValidateExit(session.role)) return NextResponse.json({ error: 'Sortie camion réservée à l’agent de saisie/garde' }, { status: 403 })
    if (camion.statut !== STATUTS.PRET_A_SORTIR) return NextResponse.json({ error: 'Le camion n’est pas prêt à sortir' }, { status: 400 })
    const numero_bl_sortie = s(body.numero_bl_sortie)
    if (!numero_bl_sortie) return NextResponse.json({ error: 'N° Bon de Livraison obligatoire' }, { status: 400 })
    const acc12=n(body.def_acceptees_12kg), acc6=n(body.def_acceptees_6kg), acc3=n(body.def_acceptees_3kg)
    const tr12=camion.def_traitees_12kg || camion.def_rendues_12kg, tr6=camion.def_traitees_6kg || camion.def_rendues_6kg, tr3=camion.def_traitees_3kg || camion.def_rendues_3kg
    const data: any = { statut: STATUTS.SORTI, sortieAt: new Date(), exitedBy: session.username, numero_bl_sortie,
      sortie_12kg: n(body.sortie_12kg), sortie_6kg: n(body.sortie_6kg), sortie_3kg: n(body.sortie_3kg),
      sortie_vides_12kg: 0, sortie_vides_6kg: 0, sortie_vides_3kg: 0,
      sortie_etr_12kg: n(body.sortie_etr_12kg), sortie_etr_6kg: n(body.sortie_etr_6kg), sortie_etr_3kg: n(body.sortie_etr_3kg),
      def_acceptees_12kg: acc12, def_acceptees_6kg: acc6, def_acceptees_3kg: acc3,
      def_refusees_12kg: Math.max(0,tr12-acc12), def_refusees_6kg: Math.max(0,tr6-acc6), def_refusees_3kg: Math.max(0,tr3-acc3),
    }
    const updated = await prisma.camionDepositaire.update({ where: { id }, data })
    await log(id, 'SORTIE_CENTRE', session, camion.statut, STATUTS.SORTI, `Sortie validée avec BL ${numero_bl_sortie}`, camion, updated)
    return NextResponse.json({ camion: updated })
  }
  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}
