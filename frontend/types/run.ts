type RunType = {
  id: number;
  name: string;
  configurations: number;
  description: string;
  instructions: string | null;
  state: number;
  projectId: number;
  createdAt: string;
  updatedAt: string;
  RunCases?: RunCaseType[];
};

type RunCaseType = {
  id: number;
  runId: number;
  caseId: number;
  status: number;
  editState: 'notChanged' | 'changed' | 'new' | 'deleted';
  createdAt: string;
  updatedAt: string;
  assigneeUserId: number | null;
};

type RunStatusCountType = {
  status: number;
  count: number;
};

type ProgressSeriesType = {
  name: string;
  data: number[];
};

type RunsMessages = {
  runList: string;
  run: string;
  newRun: string;
  editRun: string;
  deleteRun: string;
  id: string;
  name: string;
  description: string;
  lastUpdate: string;
  actions: string;
  runName: string;
  runDescription: string;
  close: string;
  create: string;
  update: string;
  pleaseEnter: string;
  noRunsFound: string;
  areYouSure: string;
  delete: string;
};

type RunGateCaseType = {
  id: number;
  title: string;
  ownerRole: number;
};

type RunGateType = {
  role: string | null;
  blocking: RunGateCaseType[];
  blockedCaseIds: number[];
  reporterBlocking: RunGateCaseType[];
};

type RunMessages = {
  backToRuns: string;
  updating: string;
  update: string;
  updatedTestRun: string;
  export: string;
  progress: string;
  refresh: string;
  id: string;
  title: string;
  pleaseEnter: string;
  description: string;
  instructions: string;
  instructionsPlaceholder: string;
  priority: string;
  status: string;
  actions: string;
  selectTestCase: string;
  casesInRun: string;
  showAllProjectCases: string;
  showOnlyRunCases: string;
  switchRun: string;
  testCaseSelection: string;
  includeInRun: string;
  excludeFromRun: string;
  noCasesFound: string;
  areYouSureLeave: string;
  lockedRun: string;
  lockedBecause: string;
  type: string;
  testDetail: string;
  steps: string;
  preconditions: string;
  expectedResult: string;
  detailsOfTheStep: string;
  close: string;
  filter: string;
  clearAll: string;
  apply: string;
  selectStatus: string;
  pleaseSave: string;
  caseTitleOrDescription: string;
  selected: string;
  tags: string;
  selectTags: string;
  comments: string;
  assignee: string;
  unassigned: string;
  assignTo: string;
  assignedToMe: string;
  assignSelected: string;
  filterByAssignee: string;
  selectAssignee: string;
  searchAssignee: string;
  waitingOnOthers: string;
  waitingOnOthersDetail: string;
  reporterIsBlocked: string;
  reporterIsBlockedDetail: string;
  caseBlocked: string;
  ownerRole: string;
  ownerEveryone: string;
  roleUpdated: string;
  roleUpdateFailed: string;
  roleManager: string;
  roleDeveloper: string;
  roleReporter: string;
};

type RunDetailMessages = {
  title: string;
  description: string;
  priority: string;
  type: string;
  tags: string;
  testDetail: string;
  steps: string;
  preconditions: string;
  expectedResult: string;
  detailsOfTheStep: string;
  caseDetail: string;
  comments: string;
  attachments: string;
  history: string;
};

export type {
  RunType,
  RunCaseType,
  RunStatusCountType,
  ProgressSeriesType,
  RunsMessages,
  RunMessages,
  RunDetailMessages,
  RunGateCaseType,
  RunGateType,
};
