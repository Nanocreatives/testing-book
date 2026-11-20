import { RunCaseVerdictType } from '@/types/case';

/**
 * Les initiales affichées sur la pastille d'un auteur.
 *
 * Deux lettres : une seule ne distingue pas deux personnes d'une même équipe.
 */
export function initialsOf(username: string): string {
  // La ponctuation de tête est retirée mot à mot : « Recette (local) » doit
  // donner RL, pas R(. Classe explicite plutôt que `\p{L}` : le drapeau `u`
  // demande une cible ES6, et celle du projet est plus ancienne.
  const words = username
    .split(/\s+/)
    .map((word) => word.replace(/^[^0-9A-Za-zÀ-ÖØ-öø-ÿ]+/, ''))
    .filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Les avis, celui de la personne qui regarde en tête.
 *
 * « Est-ce que je me suis déjà prononcée ? » est sa première question, et la
 * réponse doit tenir dans la largeur visible même quand six personnes ont jugé.
 */
export function orderJudges(verdicts: RunCaseVerdictType[], viewerId: number | null): RunCaseVerdictType[] {
  if (viewerId === null) {
    return verdicts;
  }
  const mine = verdicts.filter((verdict) => verdict.userId === viewerId);
  return mine.length === 0 ? verdicts : [...mine, ...verdicts.filter((verdict) => verdict.userId !== viewerId)];
}

/** Si les avis posés divergent — un désaccord vaut d'être rejoué, pas masqué. */
export function judgesDisagree(verdicts: RunCaseVerdictType[]): boolean {
  return new Set(verdicts.map((verdict) => verdict.status)).size > 1;
}
