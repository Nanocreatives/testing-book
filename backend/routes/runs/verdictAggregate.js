// How several verdicts on one case add up to the single status the lists and
// the chart read.
//
// `RunCase.status` stays that aggregate, derived from the verdicts and never
// edited on its own: two sources of truth for one verdict diverge the first
// time a write fails.

const UNTESTED = 0;

/**
 * Severity order — the first one present wins.
 *
 * `failed` dominates everything: a defect seen by one person is a defect, and
 * burying it under two `passed` is exactly what left two cases green for a
 * fortnight. `passed` then outranks `skipped`, which is not a harsher verdict
 * but an ABSENCE of one — somebody who could not play the case says nothing
 * about the product, whereas somebody who saw it work does.
 */
const SEVERITY = [2, 3, 1, 4];

/**
 * The status to store for a case, given every verdict on it.
 *
 * `null` when nobody has weighed in — the caller keeps the case untested rather
 * than inventing a verdict.
 */
export function aggregateStatus(statuses) {
  const given = statuses.filter((status) => status !== UNTESTED);
  if (given.length === 0) {
    return null;
  }
  return SEVERITY.find((candidate) => given.includes(candidate)) ?? UNTESTED;
}

/**
 * Whether the people who weighed in disagree.
 *
 * Disagreement is the most valuable thing this feature produces, not a flaw to
 * resolve: two testers who diverge on a case almost always reveal an ambiguous
 * statement, two different environments, or an intermittent defect.
 */
export function hasDisagreement(statuses) {
  const given = statuses.filter((status) => status !== UNTESTED);
  return new Set(given).size > 1;
}

/**
 * Whether a case has been played by as many eligible people as it asks for.
 *
 * `expected` is capped by how many people are actually ELIGIBLE: a case owned
 * by the developers would wait forever for a second opinion on a project with
 * one developer. A case nobody is eligible for asks for nothing.
 */
export function isSettled(verdictCount, expected, eligibleCount) {
  const target = Math.min(Math.max(expected, 1), eligibleCount);
  if (target === 0) {
    return false;
  }
  return verdictCount >= target;
}

/**
 * The tally a run's chart reads: one count per status, plus the cases whose
 * verdicts diverge and those still short of their target.
 *
 * Disagreement is NOT a sixth status — the stored integers are the indexes of
 * `frontend/config/selection.ts` and adding one would shift every value already
 * in the database. It is a property of the set of verdicts, counted apart.
 */
export function tallyRun(entries) {
  const byStatus = new Map();
  let disagreeing = 0;
  let awaitingVerdicts = 0;

  for (const entry of entries) {
    const statuses = entry.statuses ?? [];
    const status = aggregateStatus(statuses) ?? UNTESTED;
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);

    if (hasDisagreement(statuses)) {
      disagreeing += 1;
    }
    if (status !== UNTESTED && !isSettled(statuses.length, entry.expected, entry.eligibleCount)) {
      awaitingVerdicts += 1;
    }
  }

  return {
    statusCounts: [...byStatus.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => a.status - b.status),
    disagreeing,
    awaitingVerdicts,
  };
}
