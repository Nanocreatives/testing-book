import { getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { ProjectHome } from './ProjectHome';
import { LocaleCodeType } from '@/types/locale';
import { PriorityMessages } from '@/types/priority';
import { TestTypeMessages } from '@/types/testType';
import { TestRunCaseStatusMessages } from '@/types/status';
import { StageMessages } from '@/types/stage';

export type HomeMessages = {
  folders: string;
  testCases: string;
  testRuns: string;
  progress: string;
  testClassification: string;
  byType: string;
  byPriority: string;
};

export async function generateMetadata({ params: { locale } }: { params: { locale: LocaleCodeType } }) {
  const t = await getTranslations({ locale, namespace: 'Home' });
  return {
    title: `${t('home')} | UnitTCMS`,
    robots: { index: false, follow: false },
  };
}

export default function Page({ params }: { params: { projectId: string; locale: string } }) {
  const t = useTranslations('Home');
  const messages = {
    folders: t('Folders'),
    testCases: t('test_cases'),
    testRuns: t('test_runs'),
    progress: t('progress'),
    testClassification: t('test_classification'),
    byType: t('by_type'),
    byPriority: t('by_priority'),
  };

  const rcst = useTranslations('RunCaseStatus');
  const testRunCaseStatusMessages: TestRunCaseStatusMessages = {
    untested: rcst('untested'),
    passed: rcst('passed'),
    failed: rcst('failed'),
    retest: rcst('retest'),
    skipped: rcst('skipped'),
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

  const st = useTranslations('Stage');
  const stageMessages: StageMessages = {
    path: st('path'),
    pathIntro: st('path_intro'),
    noPath: st('no_path'),
    noPathHint: st('no_path_hint'),
    briefing: st('briefing'),
    run: st('run'),
    markAsRead: st('mark_as_read'),
    openRun: st('open_run'),
    done: st('done'),
    locked: st('locked'),
    lockedBecause: st('locked_because'),
    casesSettled: st('cases_settled'),
    addBriefing: st('add_briefing'),
    addRun: st('add_run'),
    stageTitle: st('stage_title'),
    stageContent: st('stage_content'),
    stageContentPlaceholder: st('stage_content_placeholder'),
    pickRun: st('pick_run'),
    moveUp: st('move_up'),
    moveDown: st('move_down'),
    save: st('save'),
    cancel: st('cancel'),
    edit: st('edit'),
    delete: st('delete'),
    areYouSureDeleteStage: st('are_you_sure_delete_stage'),
    stageCreated: st('stage_created'),
    stageUpdated: st('stage_updated'),
    stageDeleted: st('stage_deleted'),
    stageReordered: st('stage_reordered'),
    stageErrorTitle: st('stage_error_title'),
    stageErrorRun: st('stage_error_run'),
    stageError: st('stage_error'),
  };

  const pt = useTranslations('Priority');
  const priorityMessages: PriorityMessages = {
    critical: pt('critical'),
    high: pt('high'),
    medium: pt('medium'),
    low: pt('low'),
  };

  return (
    <>
      <ProjectHome
        projectId={params.projectId}
        locale={params.locale}
        messages={messages}
        stageMessages={stageMessages}
        testRunCaseStatusMessages={testRunCaseStatusMessages}
        testTypeMessages={testTypeMessages}
        priorityMessages={priorityMessages}
      />
    </>
  );
}
