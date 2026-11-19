/**
 * Chiffrage prévisionnel : la main-d'œuvre se calcule au coût moyen des
 * salariés productifs de l'entreprise, jamais à un tarif personnel ou à
 * un ancien taux fixé sur un modèle de tâche.
 * Les coûts individuels restent utilisés pour les pointages réels.
 */
export function quoteAverageLaborHourlyCost(averageEmployeeHourlyCostHt: number | null | undefined): number {
  const value = Number(averageEmployeeHourlyCostHt);
  return averageEmployeeHourlyCostHt != null && Number.isFinite(value) && value > 0 ? value : 0;
}
