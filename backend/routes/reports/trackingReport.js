import { aggregateStatus, hasDisagreement, isSettled } from '../runs/verdictAggregate.js';

const UNTESTED = 0;

/** Who may weigh in on a case: its role, or everyone when it names none. */
const isEligible = (memberRole, ownerRole) => ownerRole === null || ownerRole === undefined || memberRole === ownerRole;

/**
 * What the tracking page reads, from rows already fetched.
 *
 * Takes plain arrays rather than querying: the aggregation is where the thinking
 * is, and it must be testable without a database.
 *
 * ## What is deliberately absent
 *
 * No count of verdicts per person, no pace, no ranking. A report that ranks
 * testers by throughput PRODUCES cases ticked without being seen — the one
 * thing the whole campaign exists to prevent, and the easiest number to show.
 * Coverage is therefore expressed as BREADTH — which campaigns someone has
 * touched out of those they may play — which answers "where has nobody looked?"
 * instead of "who is fastest?".
 */
export function buildTrackingReport({ cases, runCases, verdicts, members, runs }) {
  const caseById = new Map(cases.map((entry) => [entry.id, entry]));
  const runById = new Map(runs.map((entry) => [entry.id, entry]));
  const memberRoles = members.map((member) => member.role);

  const eligibleCountFor = (ownerRole) => memberRoles.filter((role) => isEligible(role, ownerRole)).length;

  const verdictsByRunCase = new Map();
  for (const verdict of verdicts) {
    const bucket = verdictsByRunCase.get(verdict.runCaseId) ?? [];
    bucket.push(verdict);
    verdictsByRunCase.set(verdict.runCaseId, bucket);
  }

  const blankTally = () => ({
    cases: 0,
    played: 0,
    settled: 0,
    disagreeing: 0,
    awaiting: 0,
    statusCounts: new Map(),
  });

  const overall = blankTally();
  const byRunTally = new Map();

  // Per person: the campaigns they touched, those they may play, and how often
  // their verdict matched the others' on the cases both looked at.
  const perMember = new Map(
    members.map((member) => [
      member.userId,
      {
        userId: member.userId,
        username: member.username,
        role: member.role,
        runsTouched: new Set(),
        runsEligible: new Set(),
        comparable: 0,
        agreeing: 0,
        awaiting: 0,
      },
    ])
  );

  for (const runCase of runCases) {
    const testCase = caseById.get(runCase.caseId);
    if (!testCase) {
      continue;
    }

    const given = verdictsByRunCase.get(runCase.id) ?? [];
    const statuses = given.map((verdict) => verdict.status);
    const status = aggregateStatus(statuses) ?? UNTESTED;
    const expected = testCase.verdictsExpected ?? 1;
    const eligibleCount = eligibleCountFor(testCase.ownerRole ?? null);
    const settled = isSettled(statuses.length, expected, eligibleCount);
    const diverging = hasDisagreement(statuses);

    if (!byRunTally.has(runCase.runId)) {
      byRunTally.set(runCase.runId, blankTally());
    }

    for (const tally of [overall, byRunTally.get(runCase.runId)]) {
      tally.cases += 1;
      tally.statusCounts.set(status, (tally.statusCounts.get(status) ?? 0) + 1);
      if (status !== UNTESTED) {
        tally.played += 1;
      }
      if (settled) {
        tally.settled += 1;
      }
      if (diverging) {
        tally.disagreeing += 1;
      }
      if (status !== UNTESTED && !settled) {
        tally.awaiting += 1;
      }
    }

    const authors = new Set(given.map((verdict) => verdict.userId));
    for (const member of perMember.values()) {
      if (!isEligible(member.role, testCase.ownerRole ?? null)) {
        continue;
      }
      member.runsEligible.add(runCase.runId);

      const mine = given.find((verdict) => verdict.userId === member.userId);
      if (mine) {
        member.runsTouched.add(runCase.runId);
        const others = statuses.filter((_, index) => given[index].userId !== member.userId);
        if (others.length > 0) {
          member.comparable += 1;
          if (others.every((status) => status === mine.status)) {
            member.agreeing += 1;
          }
        }
      } else if (!settled && !authors.has(member.userId)) {
        // Ce qui lui reste à faire : un cas qu'elle peut jouer, sur lequel elle
        // ne s'est pas prononcée, et qui attend encore un avis.
        member.awaiting += 1;
      }
    }
  }

  const readTally = (tally) => ({
    cases: tally.cases,
    played: tally.played,
    settled: tally.settled,
    disagreeing: tally.disagreeing,
    awaiting: tally.awaiting,
    statusCounts: [...tally.statusCounts.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => a.status - b.status),
  });

  const byMember = [...perMember.values()].map((member) => ({
    userId: member.userId,
    username: member.username,
    role: member.role,
    runsTouched: member.runsTouched.size,
    runsEligible: member.runsEligible.size,
    comparable: member.comparable,
    agreeing: member.agreeing,
    awaiting: member.awaiting,
  }));

  const byRole = [...new Set(members.map((member) => member.role))].sort().map((role) => {
    const group = byMember.filter((member) => member.role === role);
    return {
      role,
      members: group.length,
      runsTouched: new Set(
        [...perMember.values()].filter((member) => member.role === role).flatMap((member) => [...member.runsTouched])
      ).size,
      runsEligible: new Set(
        [...perMember.values()].filter((member) => member.role === role).flatMap((member) => [...member.runsEligible])
      ).size,
      comparable: group.reduce((total, member) => total + member.comparable, 0),
      agreeing: group.reduce((total, member) => total + member.agreeing, 0),
      awaiting: group.reduce((total, member) => total + member.awaiting, 0),
    };
  });

  return {
    overall: readTally(overall),
    byRun: [...byRunTally.entries()]
      .map(([runId, tally]) => ({ runId, name: runById.get(runId)?.name ?? '', ...readTally(tally) }))
      .sort((a, b) => a.runId - b.runId),
    byMember,
    byRole,
  };
}
