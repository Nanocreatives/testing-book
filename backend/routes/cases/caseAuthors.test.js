import { describe, it, expect } from 'vitest';
import { groupAuthorsByRunCase, attachAuthors } from './caseAuthors.js';

const usernameById = new Map([
  [1, 'Nadège Loubaki'],
  [2, 'Serge Ngoma'],
]);

describe('groupAuthorsByRunCase', () => {
  it('garde les avis dans l’ordre où ils ont été posés', () => {
    const grouped = groupAuthorsByRunCase(
      [
        { runCaseId: 10, userId: 2, status: 1 },
        { runCaseId: 10, userId: 1, status: 2 },
      ],
      [],
      usernameById
    );

    expect(grouped.get(10).verdicts).toEqual([
      { userId: 2, username: 'Serge Ngoma', status: 1 },
      { userId: 1, username: 'Nadège Loubaki', status: 2 },
    ]);
  });

  it('ne nomme qu’une fois une personne qui a commenté plusieurs fois', () => {
    const grouped = groupAuthorsByRunCase(
      [],
      [
        { runCaseId: 10, userId: 1 },
        { runCaseId: 10, userId: 1 },
        { runCaseId: 10, userId: 2 },
      ],
      usernameById
    );

    expect(grouped.get(10).commenters).toEqual([
      { userId: 1, username: 'Nadège Loubaki' },
      { userId: 2, username: 'Serge Ngoma' },
    ]);
  });

  it('survit à un compte supprimé', () => {
    const grouped = groupAuthorsByRunCase([{ runCaseId: 10, userId: null, status: 2 }], [], usernameById);

    expect(grouped.get(10).verdicts).toEqual([{ userId: null, username: '', status: 2 }]);
  });
});

describe('attachAuthors', () => {
  it('rattache avis et commentateurs à chaque cas de campagne', () => {
    const grouped = groupAuthorsByRunCase(
      [{ runCaseId: 10, userId: 1, status: 1 }],
      [{ runCaseId: 10, userId: 2 }],
      usernameById
    );

    const [testCase] = attachAuthors([{ id: 5, RunCases: [{ id: 10, status: 1 }] }], grouped);

    expect(testCase.RunCases[0].Verdicts).toEqual([{ userId: 1, username: 'Nadège Loubaki', status: 1 }]);
    expect(testCase.RunCases[0].Commenters).toEqual([{ userId: 2, username: 'Serge Ngoma' }]);
  });

  it('rend des listes vides pour un cas que personne n’a touché', () => {
    const [testCase] = attachAuthors([{ id: 5, RunCases: [{ id: 11, status: 0 }] }], new Map());

    expect(testCase.RunCases[0].Verdicts).toEqual([]);
    expect(testCase.RunCases[0].Commenters).toEqual([]);
  });

  it('accepte un cas sans campagne', () => {
    const [testCase] = attachAuthors([{ id: 5 }], new Map());

    expect(testCase.RunCases).toEqual([]);
  });
});
