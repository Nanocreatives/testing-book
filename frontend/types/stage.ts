type StageKindType = {
  uid: string;
};

type StageType = {
  id: number;
  projectId: number;
  position: number;
  kind: number;
  title: string;
  content: string | null;
  runId: number | null;
  runName: string | null;
  caseTotal: number | null;
  caseSettled: number | null;
  isDone: boolean;
  isLocked: boolean;
};

type StageMessages = {
  path: string;
  pathIntro: string;
  noPath: string;
  noPathHint: string;
  briefing: string;
  run: string;
  markAsRead: string;
  openRun: string;
  done: string;
  locked: string;
  lockedBecause: string;
  casesSettled: string;
  addBriefing: string;
  addRun: string;
  stageTitle: string;
  stageContent: string;
  stageContentPlaceholder: string;
  pickRun: string;
  moveUp: string;
  moveDown: string;
  save: string;
  cancel: string;
  edit: string;
  delete: string;
  areYouSureDeleteStage: string;
  stageCreated: string;
  stageUpdated: string;
  stageDeleted: string;
  stageReordered: string;
  stageErrorTitle: string;
  stageErrorRun: string;
  stageError: string;
};

export type { StageKindType, StageType, StageMessages };
