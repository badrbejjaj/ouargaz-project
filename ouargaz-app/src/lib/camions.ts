export const STATUTS = {
  EN_ROUTE: 'EN_ROUTE',
  EN_ATTENTE: 'EN_ATTENTE',
  EN_COURS_TRAITEMENT: 'EN_COURS_TRAITEMENT',
  DEMARRAGE_EMPLISSAGE: 'DEMARRAGE_EMPLISSAGE',
  PRET_A_SORTIR: 'PRET_A_SORTIR',
  SORTI: 'SORTI',
  ANNULE: 'ANNULE',
} as const

export const STATUT_LABELS: Record<string, string> = {
  EN_ROUTE: 'En route',
  EN_ATTENTE: 'File d\'attente',
  EN_COURS_TRAITEMENT: 'En cours de traitement',
  DEMARRAGE_EMPLISSAGE: 'Démarrage emplissage',
  PRET_A_SORTIR: 'Prêt à sortir',
  SORTI: 'Sorti',
  ANNULE: 'Annulé',
}

// V6.4 règle métier officielle :
// ENTRÉE camion = VIDES + DÉFECTUEUSES + ÉTRANGÈRES
// SORTIE camion = PLEINES + DÉFECTUEUSES REFUSÉES + ÉTRANGÈRES
export function casiers12(vides=0, def=0, etr=0) { const n = vides+def+etr; return n ? Math.ceil(n / 35) : 0 }
export function casiers6(vides=0, def=0, etr=0) { const n = vides+def+etr; return n ? Math.ceil(n / 60) : 0 }
export function casiers3(vides=0, def=0, etr=0) { const n = vides+def+etr; return n ? Math.ceil(n / 120) : 0 }

export function tonnagePleines(q12=0, q6=0, q3=0) { return ((q12 * 12) + (q6 * 6) + (q3 * 3)) / 1000 }
export function tonnageDefectueuses(q12=0, q6=0, q3=0) { return ((q12 * 10) + (q6 * 5) + (q3 * 2)) / 1000 }
export function taux(remplacees: number, rendues: number) { return rendues > 0 ? (remplacees / rendues) * 100 : 0 }
export function fmt(n: number, digits=3) { return Number(n || 0).toLocaleString('fr-MA', { maximumFractionDigits: digits }) }

export function totalEntreesBouteilles(r: any) {
  return (r.vides_12kg||0)+(r.vides_6kg||0)+(r.vides_3kg||0)+
    (r.def_rendues_12kg||0)+(r.def_rendues_6kg||0)+(r.def_rendues_3kg||0)+
    (r.etrangeres_12kg||0)+(r.etrangeres_6kg||0)+(r.etrangeres_3kg||0)
}
export function totalSortiesBouteilles(r: any) {
  return (r.sortie_12kg||0)+(r.sortie_6kg||0)+(r.sortie_3kg||0)+
    (r.def_refusees_12kg||0)+(r.def_refusees_6kg||0)+(r.def_refusees_3kg||0)+
    (r.sortie_etr_12kg||0)+(r.sortie_etr_6kg||0)+(r.sortie_etr_3kg||0)
}
export function tonnageSorti(r: any) {
  return tonnagePleines(r.sortie_12kg||0,r.sortie_6kg||0,r.sortie_3kg||0) +
    tonnageDefectueuses(r.def_refusees_12kg||0,r.def_refusees_6kg||0,r.def_refusees_3kg||0)
}
