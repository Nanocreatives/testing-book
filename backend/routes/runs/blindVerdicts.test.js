import { describe, expect, it } from 'vitest';
import { isBlindForViewer, publishedStatus } from './blindVerdicts.js';

const PASSED = 1;
const FAILED = 2;

describe('isBlindForViewer', () => {
  it('ne masque rien quand personne ne s’est prononcé', () => {
    expect(isBlindForViewer({ statuses: [], viewerHasVoted: false, expected: 2, eligibleCount: 3 })).toBe(false);
  });

  it('ne masque rien à qui a déjà donné son avis', () => {
    expect(isBlindForViewer({ statuses: [PASSED], viewerHasVoted: true, expected: 2, eligibleCount: 3 })).toBe(false);
  });

  it('masque l’avis d’autrui tant que le cas en attend un autre', () => {
    expect(isBlindForViewer({ statuses: [PASSED], viewerHasVoted: false, expected: 2, eligibleCount: 3 })).toBe(true);
  });

  it('ne masque plus un cas réglé : on ne demande plus rien à personne', () => {
    expect(isBlindForViewer({ statuses: [PASSED], viewerHasVoted: false, expected: 1, eligibleCount: 3 })).toBe(false);
  });

  it('ne masque plus quand l’objectif est atteint à deux avis', () => {
    expect(isBlindForViewer({ statuses: [PASSED, FAILED], viewerHasVoted: false, expected: 2, eligibleCount: 3 })).toBe(
      false
    );
  });

  it('ne masque rien quand une seule personne est éligible', () => {
    // L'objectif est plafonné par les éligibles : le cas est déjà réglé.
    expect(isBlindForViewer({ statuses: [PASSED], viewerHasVoted: false, expected: 2, eligibleCount: 1 })).toBe(false);
  });
});

describe('publishedStatus', () => {
  it('publie le statut quand rien n’est masqué', () => {
    expect(publishedStatus({ status: FAILED, blind: false })).toBe(FAILED);
  });

  it('publie « non testé » plutôt que d’omettre le champ', () => {
    // Ce qui ignore le masquage lit quand même un statut valide.
    expect(publishedStatus({ status: FAILED, blind: true })).toBe(0);
  });
});
