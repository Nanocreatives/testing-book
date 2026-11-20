// Qui a jugé un cas, et qui l'a commenté.
//
// Deux requêtes à part plutôt qu'une jointure de plus : une seconde branche
// `hasMany` à côté des étiquettes multiplierait les lignes, et le compte des
// commentaires sortirait faux sans que rien ne le signale.

/**
 * Regroupe avis et commentateurs par cas de campagne.
 *
 * L'ordre des avis est celui où ils ont été posés : savoir qui a jugé en
 * premier est ce qui permet de relire un désaccord.
 */
export function groupAuthorsByRunCase(verdicts, commenters, usernameById) {
  const byRunCase = new Map();

  const bucket = (runCaseId) => {
    const found = byRunCase.get(runCaseId);
    if (found) {
      return found;
    }
    const created = { verdicts: [], commenters: [] };
    byRunCase.set(runCaseId, created);
    return created;
  };

  for (const verdict of verdicts) {
    bucket(verdict.runCaseId).verdicts.push({
      userId: verdict.userId ?? null,
      username: usernameById.get(verdict.userId) ?? '',
      status: verdict.status,
    });
  }

  // Une personne qui a écrit trois fois n'est nommée qu'une fois : la colonne
  // dit qui a parlé, le compte dit combien de messages.
  for (const commenter of commenters) {
    const named = bucket(commenter.runCaseId).commenters;
    if (named.some((entry) => entry.userId === commenter.userId)) {
      continue;
    }
    named.push({
      userId: commenter.userId ?? null,
      username: usernameById.get(commenter.userId) ?? '',
    });
  }

  return byRunCase;
}

/**
 * Recopie les cas en y rattachant leurs auteurs.
 *
 * Les instances Sequelize sont figées en objets simples : y ajouter un champ
 * sans passer par `toJSON` ne survit pas à la sérialisation.
 */
export function attachAuthors(cases, byRunCase) {
  return cases.map((testCase) => {
    const plain = typeof testCase.toJSON === 'function' ? testCase.toJSON() : testCase;
    return {
      ...plain,
      RunCases: (plain.RunCases ?? []).map((runCase) => ({
        ...runCase,
        Verdicts: byRunCase.get(runCase.id)?.verdicts ?? [],
        Commenters: byRunCase.get(runCase.id)?.commenters ?? [],
      })),
    };
  });
}
