import { BAREME_DATA } from './bareme-data'

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────
export const CAPACITE_RESERVOIR = 150000 // Litres
export const DENSITE_GPL_15C = 0.572 // kg/L
export const MASSE_MOLAIRE_GPL = 58.124 // g/mol
export const PRESSION_ATM = 1.013 // bar
export const PRESSION_ATM_EXCEL = 1.01325 // bar - valeur utilisée dans le classeur Excel officiel
export const SHRINKAGE_FACTOR = 1

// ─────────────────────────────────────────────────────────
// Barème lookup with linear interpolation
// ─────────────────────────────────────────────────────────
export function getVolumeFromNiveau(niveauMm: number): number {
  if (niveauMm <= 0) return 0
  if (niveauMm >= 2974) return 150046

  // Binary search for surrounding values
  let lo = 0
  let hi = BAREME_DATA.length - 1

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (BAREME_DATA[mid][0] === niveauMm) {
      return BAREME_DATA[mid][1]
    } else if (BAREME_DATA[mid][0] < niveauMm) {
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  // Interpolate between BAREME_DATA[hi] and BAREME_DATA[lo]
  if (hi < 0) return BAREME_DATA[0][1]
  if (lo >= BAREME_DATA.length) return BAREME_DATA[BAREME_DATA.length - 1][1]

  const [n1, v1] = BAREME_DATA[hi]
  const [n2, v2] = BAREME_DATA[lo]

  // Linear interpolation: V = V1 + ((N - N1) / (N2 - N1)) × (V2 - V1)
  return v1 + ((niveauMm - n1) / (n2 - n1)) * (v2 - v1)
}

// ─────────────────────────────────────────────────────────
// VCF (Volume Correction Factor) - Approximation ASTM 54B
// For GPL (Butane), relative to 15°C reference
// ─────────────────────────────────────────────────────────
export function calculateVCF(temperature: number): number {
  // Méthode officielle OUARGAZ issue du classeur Excel "MAJ RAPPORT".
  // Feuil1 / TABLE 54B PRODUCT pour Butane densité 15°C = 0.572 kg/L.
  // TEMP1 = INT((T + 0.125) * 4) / 4
  // AH = ROUND(AF / DEN^2 + AQ / DEN, 7) avec DEN = 572, AF = 346.4228, AQ = 0.4388
  // VCF = ROUND(EXP(-AH * (TEMP1-15) * (1 + 0.8 * AH * (TEMP1-15))), 4)
  const temp1 = Math.floor((temperature + 0.125) * 4) / 4
  const deltaT = temp1 - 15
  const den = 572
  const af = 346.4228
  const aq = 0.4388
  const ah = Math.round(((af / Math.pow(den, 2)) + (aq / den)) * 10000000) / 10000000
  const vcf = Math.exp(-ah * deltaT * (1 + 0.8 * ah * deltaT))
  return Math.round(vcf * 10000) / 10000
}

// ─────────────────────────────────────────────────────────
// Full reservoir calculation
// ─────────────────────────────────────────────────────────
export interface ReservoirResult {
  volume_obs: number     // L
  vcf: number
  gsv: number            // L (standard)
  masse_liquide_t: number // tonnes
  volume_vapeur: number  // L
  pression_abs: number   // bar
  densite_vapeur: number // t/m³
  masse_vapeur_t: number // tonnes
  tonnage_total: number  // tonnes
  remplissage_pct: number // %
}

export function calculateReservoir(
  niveauMm: number,
  temperatureC: number,
  pressionBar: number
): ReservoirResult {
  // Volume observé from barème
  const volume_obs = getVolumeFromNiveau(niveauMm)

  // VCF
  const vcf = calculateVCF(temperatureC)

  // GSV = Volume observé × VCF
  const gsv = volume_obs * vcf

  // Masse liquide (tonnes) = GSV × densité / 1000
  const masse_liquide_t = (gsv * DENSITE_GPL_15C) / 1000

  // Volume vapeur
  const volume_vapeur = CAPACITE_RESERVOIR - volume_obs

  // Pression absolue = pression relative + pression atmosphérique
  const pression_abs = pressionBar + PRESSION_ATM_EXCEL

  // Densité vapeur (t/m³) = (12.027 × P_abs × M) / (273.15 + T) / 1000
  // Using ideal gas law for GPL vapour density
  const densite_vapeur =
    (12.027 * pression_abs * MASSE_MOLAIRE_GPL) /
    (273.15 + temperatureC) /
    1000

  // Masse vapeur (tonnes) = Volume vapeur (L) × densité / 1000
  const masse_vapeur_t = (volume_vapeur * densite_vapeur) / 1000

  // Tonnage total
  const tonnage_total = masse_liquide_t + masse_vapeur_t

  // % remplissage
  const remplissage_pct = (volume_obs / CAPACITE_RESERVOIR) * 100

  return {
    volume_obs: Math.round(volume_obs),
    vcf: Math.round(vcf * 10000) / 10000,
    gsv: Math.round(gsv),
    masse_liquide_t: Math.round(masse_liquide_t * 1000) / 1000,
    volume_vapeur: Math.round(volume_vapeur),
    pression_abs: Math.round(pression_abs * 1000) / 1000,
    densite_vapeur: Math.round(densite_vapeur * 10000) / 10000,
    masse_vapeur_t: Math.round(masse_vapeur_t * 1000) / 1000,
    tonnage_total: Math.round(tonnage_total * 1000) / 1000,
    remplissage_pct: Math.round(remplissage_pct * 100) / 100,
  }
}

// ─────────────────────────────────────────────────────────
// Stock bouteilles calculations
// ─────────────────────────────────────────────────────────
export function calculateStockCond(data: {
  pleines_12kg: number
  pleines_6kg: number
  pleines_3kg: number
  defectueuses_12kg: number
  defectueuses_6kg: number
  defectueuses_3kg: number
}) {
  const stock_pleines_kg =
    data.pleines_12kg * 12 +
    data.pleines_6kg * 6 +
    data.pleines_3kg * 3

  const stock_def_kg =
    data.defectueuses_12kg * 10 +
    data.defectueuses_6kg * 5 +
    data.defectueuses_3kg * 2

  const stock_cond_kg = stock_pleines_kg + stock_def_kg
  const stock_cond_t = stock_cond_kg / 1000

  return { stock_pleines_kg, stock_def_kg, stock_cond_kg, stock_cond_t }
}

// ─────────────────────────────────────────────────────────
// Ventes calculations
// ─────────────────────────────────────────────────────────
export function calculateVentePoids(
  qte_12kg: number,
  qte_3kg: number,
  qte_6kg: number,
  qte_34kg: number = 0
) {
  const poids_kg = qte_12kg * 12 + qte_3kg * 3 + qte_6kg * 6 + qte_34kg * 34
  const poids_t = poids_kg / 1000
  return { poids_kg, poids_t }
}

// ─────────────────────────────────────────────────────────
// Stock comptable
// ─────────────────────────────────────────────────────────
export function calculateStockComptable(
  stockDebutTotal: number,  // tonnes
  appro: number,            // tonnes
  empl: number              // tonnes
) {
  // Stock comptable = Stock début + Appro - Ventes_jour
  // Empl = Emplissage = ce qui sort en conditionné
  return stockDebutTotal + appro - empl
}

// ─────────────────────────────────────────────────────────
// Boni/Mali
// ─────────────────────────────────────────────────────────
export function calculateBoniMali(
  stockComptable: number,   // tonnes
  stockPhysique: number     // tonnes
) {
  const boniMaliKg = (stockPhysique - stockComptable) * 1000
  return boniMaliKg
}

export function calculateBoniMaliPct(
  boniMaliKg: number,
  emplissageKg: number
): number {
  if (emplissageKg === 0) return 0
  return (boniMaliKg / emplissageKg) * 100
}
