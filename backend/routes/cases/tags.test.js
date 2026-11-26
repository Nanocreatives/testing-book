import { describe, it, expect } from 'vitest';
import { planCaseTags, MAX_TAGS_PER_CASE } from './tags.js';

const plan = (overrides) => planCaseTags({ caseIds: [1], current: new Map(), ...overrides });

describe('planCaseTags', () => {
  it('attache ce qui manque et n’écrit rien pour ce qui est déjà là', () => {
    const { links, unlinks, skipped } = planCaseTags({
      caseIds: [1, 2],
      current: new Map([[1, [10]]]),
      addTagIds: [10, 11],
    });

    expect(links).toEqual([
      { caseId: 1, tagId: 11 },
      { caseId: 2, tagId: 10 },
      { caseId: 2, tagId: 11 },
    ]);
    expect(unlinks).toEqual([]);
    expect(skipped).toEqual([]);
  });

  it('détache ce qui est nommé, et laisse le reste', () => {
    const { links, unlinks } = planCaseTags({
      caseIds: [1],
      current: new Map([[1, [10, 11, 12]]]),
      removeTagIds: [11],
    });

    expect(links).toEqual([]);
    expect(unlinks).toEqual([{ caseId: 1, tagId: 11 }]);
  });

  it('ne touche jamais à une étiquette qui n’est pas nommée', () => {
    const { links, unlinks } = planCaseTags({
      caseIds: [1],
      current: new Map([[1, [99]]]),
      addTagIds: [10],
      removeTagIds: [11],
    });

    expect(links).toEqual([{ caseId: 1, tagId: 10 }]);
    expect(unlinks).toEqual([]);
  });

  it('retirer puis remettre la même étiquette la garde', () => {
    const { links, unlinks } = planCaseTags({
      caseIds: [1],
      current: new Map([[1, [10]]]),
      addTagIds: [10],
      removeTagIds: [10],
    });

    expect(links).toEqual([]);
    expect(unlinks).toEqual([]);
  });

  it('écarte le cas entier plutôt que de dépasser la limite', () => {
    const { links, unlinks, skipped } = planCaseTags({
      caseIds: [1],
      current: new Map([[1, [1, 2, 3, 4, 5]]]),
      addTagIds: [6],
    });

    expect(skipped).toEqual([1]);
    expect(links).toEqual([]);
    expect(unlinks).toEqual([]);
  });

  it('un retrait qui fait de la place laisse passer l’ajout', () => {
    const { links, unlinks, skipped } = planCaseTags({
      caseIds: [1],
      current: new Map([[1, [1, 2, 3, 4, 5]]]),
      addTagIds: [6],
      removeTagIds: [5],
    });

    expect(skipped).toEqual([]);
    expect(links).toEqual([{ caseId: 1, tagId: 6 }]);
    expect(unlinks).toEqual([{ caseId: 1, tagId: 5 }]);
  });

  it('atteindre exactement la limite est permis', () => {
    const { skipped } = planCaseTags({
      caseIds: [1],
      current: new Map([[1, [1, 2, 3, 4]]]),
      addTagIds: [5],
    });

    expect(MAX_TAGS_PER_CASE).toBe(5);
    expect(skipped).toEqual([]);
  });

  it('un doublon dans la demande ne produit qu’une liaison', () => {
    const { links } = plan({ addTagIds: [10, 10] });

    expect(links).toEqual([{ caseId: 1, tagId: 10 }]);
  });

  it('sans rien à faire, ne rend rien à écrire', () => {
    const { links, unlinks, skipped } = plan({});

    expect(links).toEqual([]);
    expect(unlinks).toEqual([]);
    expect(skipped).toEqual([]);
  });
});
