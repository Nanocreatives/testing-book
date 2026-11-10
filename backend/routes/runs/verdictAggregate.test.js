import { describe, expect, it } from 'vitest';
import { aggregateStatus, hasDisagreement, isSettled, tallyRun } from './verdictAggregate.js';

// Les index de `frontend/config/selection.ts` : l'ordre du tableau EST la
// valeur stockée.
const UNTESTED = 0;
const PASSED = 1;
const FAILED = 2;
const RETEST = 3;
const SKIPPED = 4;

describe('aggregateStatus', () => {
  it('ne rend rien tant que personne ne s’est prononcé', () => {
    expect(aggregateStatus([])).toBeNull();
    expect(aggregateStatus([UNTESTED, UNTESTED])).toBeNull();
  });

  it('rend le verdict unique quand il n’y en a qu’un', () => {
    expect(aggregateStatus([PASSED])).toBe(PASSED);
  });

  it('laisse un seul échec l’emporter sur deux réussites', () => {
    expect(aggregateStatus([PASSED, FAILED, PASSED])).toBe(FAILED);
  });

  it('place « à retester » au-dessus d’une réussite', () => {
    expect(aggregateStatus([PASSED, RETEST])).toBe(RETEST);
  });

  it('préfère une réussite à un ignoré : l’un a vu, l’autre n’a pas pu', () => {
    expect(aggregateStatus([SKIPPED, PASSED])).toBe(PASSED);
  });

  it('rend « ignoré » quand c’est le seul verdict', () => {
    expect(aggregateStatus([SKIPPED])).toBe(SKIPPED);
  });
});

describe('hasDisagreement', () => {
  it('ne voit aucun désaccord sur un verdict seul', () => {
    expect(hasDisagreement([PASSED])).toBe(false);
  });

  it('ne voit aucun désaccord quand tous disent la même chose', () => {
    expect(hasDisagreement([PASSED, PASSED, PASSED])).toBe(false);
  });

  it('voit le désaccord dès que deux verdicts diffèrent', () => {
    expect(hasDisagreement([PASSED, FAILED])).toBe(true);
  });

  it('ignore les non-testés : une absence n’est pas un avis contraire', () => {
    expect(hasDisagreement([PASSED, UNTESTED])).toBe(false);
  });
});

describe('isSettled', () => {
  it('se contente d’un avis quand un seul est attendu', () => {
    expect(isSettled(1, 1, 3)).toBe(true);
  });

  it('en attend deux quand le cas en demande deux', () => {
    expect(isSettled(1, 2, 3)).toBe(false);
    expect(isSettled(2, 2, 3)).toBe(true);
  });

  it('plafonne l’objectif au nombre de personnes éligibles', () => {
    // Un cas réservé aux développeurs sur un projet qui n'en compte qu'un
    // attendrait sinon un second avis pour toujours.
    expect(isSettled(1, 2, 1)).toBe(true);
  });

  it('n’est jamais réglé quand personne n’est éligible', () => {
    expect(isSettled(0, 1, 0)).toBe(false);
    expect(isSettled(3, 1, 0)).toBe(false);
  });

  it('traite un objectif absurde comme un avis', () => {
    expect(isSettled(1, 0, 2)).toBe(true);
  });
});

describe('tallyRun', () => {
  it('compte un cas sans verdict comme non testé', () => {
    const tally = tallyRun([{ statuses: [], expected: 1, eligibleCount: 2 }]);
    expect(tally.statusCounts).toEqual([{ status: UNTESTED, count: 1 }]);
    expect(tally.disagreeing).toBe(0);
    expect(tally.awaitingVerdicts).toBe(0);
  });

  it('range chaque cas sous son statut agrégé', () => {
    const tally = tallyRun([
      { statuses: [PASSED], expected: 1, eligibleCount: 2 },
      { statuses: [PASSED, FAILED], expected: 2, eligibleCount: 2 },
    ]);
    expect(tally.statusCounts).toEqual([
      { status: PASSED, count: 1 },
      { status: FAILED, count: 1 },
    ]);
  });

  it('compte les désaccords à part des statuts', () => {
    const tally = tallyRun([{ statuses: [PASSED, FAILED], expected: 2, eligibleCount: 2 }]);
    expect(tally.disagreeing).toBe(1);
  });

  it('compte les cas joués mais encore à court d’avis', () => {
    const tally = tallyRun([{ statuses: [PASSED], expected: 2, eligibleCount: 3 }]);
    expect(tally.awaitingVerdicts).toBe(1);
  });

  it('ne compte pas un cas non testé comme en attente d’avis', () => {
    // Il est déjà compté comme non testé : l'annoncer aussi « en attente »
    // ferait deux fois le même reproche.
    const tally = tallyRun([{ statuses: [], expected: 2, eligibleCount: 3 }]);
    expect(tally.awaitingVerdicts).toBe(0);
  });
});
