import { RunStatusCountType } from './run';

export type TrackingTallyType = {
  cases: number;
  played: number;
  settled: number;
  disagreeing: number;
  awaiting: number;
  statusCounts: RunStatusCountType[];
};

export type TrackingRunType = TrackingTallyType & {
  runId: number;
  name: string;
};

/**
 * Volontairement sans volume ni cadence : un rapport qui classe les testeurs
 * par débit produit des cases cochées sans avoir été vues.
 */
export type TrackingMemberType = {
  userId: number;
  username: string;
  role: number;
  runsTouched: number;
  runsEligible: number;
  comparable: number;
  agreeing: number;
  awaiting: number;
};

export type TrackingRoleType = {
  role: number;
  members: number;
  runsTouched: number;
  runsEligible: number;
  comparable: number;
  agreeing: number;
  awaiting: number;
};

export type TrackingReportType = {
  overall: TrackingTallyType;
  byRun: TrackingRunType[];
  byMember: TrackingMemberType[];
  byRole: TrackingRoleType[];
};

export type TrackingMessages = {
  title: string;
  subtitle: string;
  overall: string;
  byMember: string;
  byRole: string;
  campaign: string;
  cases: string;
  played: string;
  settled: string;
  settledHint: string;
  disagreeing: string;
  disagreeingHint: string;
  awaiting: string;
  member: string;
  role: string;
  membersCount: string;
  coverage: string;
  coverageHint: string;
  agreement: string;
  notComparable: string;
  notComparableHint: string;
  remaining: string;
  noData: string;
  manager: string;
  developer: string;
  reporter: string;
};
