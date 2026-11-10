import { useTranslations } from 'next-intl';
import RunEditor from './RunEditor';
import ResizablePanes from '@/components/ResizablePane';
import { RunMessages } from '@/types/run';
import { PriorityMessages } from '@/types/priority';
import { RunStatusMessages, TestRunCaseStatusMessages } from '@/types/status';
import { TestTypeMessages } from '@/types/testType';

export default function RunLayout({
  children,
  params: { projectId, runId, locale },
}: {
  children: React.ReactNode;
  params: { projectId: string; runId: string; locale: string };
}) {
  const t = useTranslations('Run');
  const mt = useTranslations('Members');
  const messages: RunMessages = {
    backToRuns: t('back_to_runs'),
    updating: t('updating'),
    update: t('update'),
    updatedTestRun: t('updated_test_run'),
    export: t('export'),
    progress: t('progress'),
    refresh: t('refresh'),
    id: t('id'),
    title: t('title'),
    pleaseEnter: t('please_enter'),
    description: t('description'),
    instructions: t('instructions'),
    instructionsPlaceholder: t('instructions_placeholder'),
    priority: t('priority'),
    actions: t('actions'),
    status: t('status'),
    selectTestCase: t('select_test_case'),
    casesInRun: t('cases_in_run'),
    showAllProjectCases: t('show_all_project_cases'),
    showOnlyRunCases: t('show_only_run_cases'),
    switchRun: t('switch_run'),
    testCaseSelection: t('test_case_selection'),
    includeInRun: t('include_in_run'),
    excludeFromRun: t('exclude_from_run'),
    noCasesFound: t('no_cases_found'),
    areYouSureLeave: t('are_you_sure_leave'),
    lockedRun: t('locked_run'),
    lockedBecause: t('locked_because'),
    type: t('type'),
    testDetail: t('test_detail'),
    steps: t('steps'),
    preconditions: t('preconditions'),
    expectedResult: t('expected_result'),
    detailsOfTheStep: t('details_of_the_step'),
    close: t('close'),
    filter: t('filter'),
    clearAll: t('clear_all'),
    apply: t('apply'),
    selectStatus: t('select_status'),
    pleaseSave: t('please_save'),
    caseTitleOrDescription: t('case_title_or_description'),
    selected: t('selected'),
    tags: t('tags'),
    selectTags: t('select_tags'),
    comments: t('comments'),
    assignee: t('assignee'),
    unassigned: t('unassigned'),
    assignTo: t('assign_to'),
    assignedToMe: t('assigned_to_me'),
    assignSelected: t('assign_selected'),
    filterByAssignee: t('filter_by_assignee'),
    selectAssignee: t('select_assignee'),
    searchAssignee: t('search_assignee'),
    waitingOnOthers: t('waiting_on_others'),
    waitingOnOthersDetail: t('waiting_on_others_detail'),
    reporterIsBlocked: t('reporter_is_blocked'),
    reporterIsBlockedDetail: t('reporter_is_blocked_detail'),
    caseBlocked: t('case_blocked'),
    ownerRole: t('owner_role'),
    ownerEveryone: t('owner_everyone'),
    roleUpdated: t('role_updated'),
    roleUpdateFailed: t('role_update_failed'),
    roleManager: mt('manager'),
    roleDeveloper: mt('developer'),
    roleReporter: mt('reporter'),
  };

  const rst = useTranslations('RunStatus');
  const runStatusMessages: RunStatusMessages = {
    new: rst('new'),
    inProgress: rst('inProgress'),
    underReview: rst('underReview'),
    rejected: rst('rejected'),
    done: rst('done'),
    closed: rst('closed'),
  };

  const rcst = useTranslations('RunCaseStatus');
  const testRunCaseStatusMessages: TestRunCaseStatusMessages = {
    untested: rcst('untested'),
    passed: rcst('passed'),
    failed: rcst('failed'),
    retest: rcst('retest'),
    skipped: rcst('skipped'),
  };

  const pt = useTranslations('Priority');
  const priorityMessages: PriorityMessages = {
    critical: pt('critical'),
    high: pt('high'),
    medium: pt('medium'),
    low: pt('low'),
  };

  const tt = useTranslations('Type');
  const testTypeMessages: TestTypeMessages = {
    other: tt('other'),
    security: tt('security'),
    performance: tt('performance'),
    accessibility: tt('accessibility'),
    functional: tt('functional'),
    acceptance: tt('acceptance'),
    usability: tt('usability'),
    smokeSanity: tt('smoke_sanity'),
    compatibility: tt('compatibility'),
    destructive: tt('destructive'),
    regression: tt('regression'),
    automated: tt('automated'),
    manual: tt('manual'),
  };

  return (
    <ResizablePanes
      leftPane={
        <RunEditor
          projectId={projectId}
          runId={runId}
          messages={messages}
          runStatusMessages={runStatusMessages}
          testRunCaseStatusMessages={testRunCaseStatusMessages}
          priorityMessages={priorityMessages}
          testTypeMessages={testTypeMessages}
          locale={locale}
        />
      }
      rightPane={children}
    />
  );
}
