export const OUARGAZ_THRESHOLDS = {
  stockVracCriticalT: 50,
  boniMaliPctLimit: 3,
}

export const OUARGAZ_THRESHOLD_TEXT = {
  stockVrac: `Alerte rouge si stock VRAC < ${OUARGAZ_THRESHOLDS.stockVracCriticalT} tonnes. État normal si stock VRAC >= ${OUARGAZ_THRESHOLDS.stockVracCriticalT} tonnes.`,
  boniMali: `Alerte rouge si Boni/Mali % < ${OUARGAZ_THRESHOLDS.boniMaliPctLimit} %. État vert si Boni/Mali % >= ${OUARGAZ_THRESHOLDS.boniMaliPctLimit} %.`,
}
