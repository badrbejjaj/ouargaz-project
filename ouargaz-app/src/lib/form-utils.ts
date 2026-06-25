/**
 * Utilitaires de formulaire V6.6
 * - Champs numériques vides au chargement
 * - Conversion automatique: vide → 0
 */

export function formatEmptyNumber(value: any): string {
  if (value === null || value === undefined || value === 0) {
    return '';
  }
  return String(value);
}

export function parseEmptyNumber(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = parseInt(trimmed, 10);
  return isNaN(parsed) ? 0 : parsed;
}

export const numberInputConfig = {
  type: 'number',
  min: '0',
  pattern: '[0-9]*',
  inputMode: 'numeric' as const,
};
