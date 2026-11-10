import { describe, expect, it } from 'vitest';
import { buildTrackingReport } from './trackingReport.js';

const PASSED = 1;
const FAILED = 2;

const MANAGER = 0;
const DEVELOPER = 1;
const REPORTER = 2;

const ANNE = 11;
const BRUNO = 12;
const CHANTAL = 13;

/** Un projet minimal : deux campagnes, trois membres, des cas qu'on choisit. */
const build = ({ cases, runCases, verdicts, members = null }) =>
  buildTrackingReport({
    cases,
    runCases,
    verdicts,
    members: members ?? [
      { userId: ANNE, username: 'Anne', role: REPORTER },
      { userId: BRUNO, username: 'Bruno', role: REPORTER },
      { userId: CHANTAL, username: 'Chantal', role: DEVELOPER },
    ],
    runs: [
      { id: 1, name: 'Vague 0' },
      { id: 2, name: 'Vague 1' },
    ],
  });

const memberNamed = (report, userId) => report.byMember.find((member) => member.userId === userId);

describe('buildTrackingReport — général', () => {
  it('rend un rapport vide sans rien casser', () => {
    const report = build({ cases: [], runCases: [], verdicts: [] });
    expect(report.overall.cases).toBe(0);
    expect(report.byRun).toEqual([]);
  });

  it('compte un cas joué, réglé, et sans désaccord', () => {
    const report = build({
      cases: [{ id: 1, ownerRole: null, verdictsExpected: 1 }],
      runCases: [{ id: 100, runId: 1, caseId: 1 }],
      verdicts: [{ runCaseId: 100, userId: ANNE, status: PASSED }],
    });

    expect(report.overall).toMatchObject({ cases: 1, played: 1, settled: 1, disagreeing: 0, awaiting: 0 });
  });

  it('compte un cas joué mais à court d’avis', () => {
    const report = build({
      cases: [{ id: 1, ownerRole: null, verdictsExpected: 2 }],
      runCases: [{ id: 100, runId: 1, caseId: 1 }],
      verdicts: [{ runCaseId: 100, userId: ANNE, status: PASSED }],
    });

    expect(report.overall).toMatchObject({ played: 1, settled: 0, awaiting: 1 });
  });

  it('compte le désaccord sans le retirer de son statut', () => {
    const report = build({
      cases: [{ id: 1, ownerRole: null, verdictsExpected: 2 }],
      runCases: [{ id: 100, runId: 1, caseId: 1 }],
      verdicts: [
        { runCaseId: 100, userId: ANNE, status: PASSED },
        { runCaseId: 100, userId: BRUNO, status: FAILED },
      ],
    });

    expect(report.overall.disagreeing).toBe(1);
    // L'échec l'emporte, et le cas reste compté comme tel.
    expect(report.overall.statusCounts).toEqual([{ status: FAILED, count: 1 }]);
  });

  it('ventile par campagne', () => {
    const report = build({
      cases: [
        { id: 1, ownerRole: null, verdictsExpected: 1 },
        { id: 2, ownerRole: null, verdictsExpected: 1 },
      ],
      runCases: [
        { id: 100, runId: 1, caseId: 1 },
        { id: 200, runId: 2, caseId: 2 },
      ],
      verdicts: [{ runCaseId: 100, userId: ANNE, status: PASSED }],
    });

    expect(report.byRun.map((run) => [run.name, run.played])).toEqual([
      ['Vague 0', 1],
      ['Vague 1', 0],
    ]);
  });
});

describe('buildTrackingReport — par membre', () => {
  it('ne publie ni volume ni cadence', () => {
    const report = build({
      cases: [{ id: 1, ownerRole: null, verdictsExpected: 1 }],
      runCases: [{ id: 100, runId: 1, caseId: 1 }],
      verdicts: [{ runCaseId: 100, userId: ANNE, status: PASSED }],
    });

    const anne = memberNamed(report, ANNE);
    expect(Object.keys(anne).sort()).toEqual(
      ['agreeing', 'awaiting', 'comparable', 'role', 'runsEligible', 'runsTouched', 'userId', 'username'].sort()
    );
  });

  it('mesure la couverture en campagnes touchées sur campagnes jouables', () => {
    const report = build({
      cases: [
        { id: 1, ownerRole: null, verdictsExpected: 1 },
        { id: 2, ownerRole: null, verdictsExpected: 1 },
      ],
      runCases: [
        { id: 100, runId: 1, caseId: 1 },
        { id: 200, runId: 2, caseId: 2 },
      ],
      verdicts: [{ runCaseId: 100, userId: ANNE, status: PASSED }],
    });

    expect(memberNamed(report, ANNE)).toMatchObject({ runsTouched: 1, runsEligible: 2 });
    expect(memberNamed(report, BRUNO)).toMatchObject({ runsTouched: 0, runsEligible: 2 });
  });

  it('ne rend éligible un cas de développeur qu’aux développeurs', () => {
    const report = build({
      cases: [{ id: 1, ownerRole: DEVELOPER, verdictsExpected: 1 }],
      runCases: [{ id: 100, runId: 1, caseId: 1 }],
      verdicts: [],
    });

    expect(memberNamed(report, CHANTAL)).toMatchObject({ runsEligible: 1, awaiting: 1 });
    expect(memberNamed(report, ANNE)).toMatchObject({ runsEligible: 0, awaiting: 0 });
  });

  it('ne compare que les cas que deux personnes ont jugés', () => {
    const report = build({
      cases: [
        { id: 1, ownerRole: null, verdictsExpected: 2 },
        { id: 2, ownerRole: null, verdictsExpected: 2 },
      ],
      runCases: [
        { id: 100, runId: 1, caseId: 1 },
        { id: 200, runId: 1, caseId: 2 },
      ],
      verdicts: [
        { runCaseId: 100, userId: ANNE, status: PASSED },
        { runCaseId: 100, userId: BRUNO, status: PASSED },
        { runCaseId: 200, userId: ANNE, status: PASSED },
      ],
    });

    // Le second cas n'a qu'un avis : il n'est comparable pour personne.
    expect(memberNamed(report, ANNE)).toMatchObject({ comparable: 1, agreeing: 1 });
  });

  it('compte un désaccord comme comparable mais non concordant', () => {
    const report = build({
      cases: [{ id: 1, ownerRole: null, verdictsExpected: 2 }],
      runCases: [{ id: 100, runId: 1, caseId: 1 }],
      verdicts: [
        { runCaseId: 100, userId: ANNE, status: PASSED },
        { runCaseId: 100, userId: BRUNO, status: FAILED },
      ],
    });

    expect(memberNamed(report, ANNE)).toMatchObject({ comparable: 1, agreeing: 0 });
    expect(memberNamed(report, BRUNO)).toMatchObject({ comparable: 1, agreeing: 0 });
  });

  it('n’attend plus rien de quelqu’un sur un cas déjà réglé', () => {
    const report = build({
      cases: [{ id: 1, ownerRole: null, verdictsExpected: 1 }],
      runCases: [{ id: 100, runId: 1, caseId: 1 }],
      verdicts: [{ runCaseId: 100, userId: ANNE, status: PASSED }],
    });

    expect(memberNamed(report, BRUNO).awaiting).toBe(0);
  });
});

describe('buildTrackingReport — par rôle', () => {
  it('regroupe sans compter deux fois une campagne touchée par deux membres', () => {
    const report = build({
      cases: [
        { id: 1, ownerRole: null, verdictsExpected: 2 },
        { id: 2, ownerRole: null, verdictsExpected: 2 },
      ],
      runCases: [
        { id: 100, runId: 1, caseId: 1 },
        { id: 200, runId: 1, caseId: 2 },
      ],
      verdicts: [
        { runCaseId: 100, userId: ANNE, status: PASSED },
        { runCaseId: 200, userId: BRUNO, status: PASSED },
      ],
    });

    const reporters = report.byRole.find((group) => group.role === REPORTER);
    expect(reporters).toMatchObject({ members: 2, runsTouched: 1, runsEligible: 1 });
  });

  it('ne retient que les rôles réellement présents', () => {
    const report = build({
      cases: [{ id: 1, ownerRole: null, verdictsExpected: 1 }],
      runCases: [{ id: 100, runId: 1, caseId: 1 }],
      verdicts: [],
      members: [{ userId: ANNE, username: 'Anne', role: MANAGER }],
    });

    expect(report.byRole.map((group) => group.role)).toEqual([MANAGER]);
  });
});
