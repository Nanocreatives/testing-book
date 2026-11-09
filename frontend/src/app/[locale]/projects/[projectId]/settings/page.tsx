import { getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import SettingsPage from './SettingsPage';
import { LocaleCodeType } from '@/types/locale';
import { ProjectDialogMessages } from '@/types/project';
import { SettingsMessages } from '@/types/settings';
import { StageMessages } from '@/types/stage';

export async function generateMetadata({ params: { locale } }: { params: { locale: LocaleCodeType } }) {
  const t = await getTranslations({ locale, namespace: 'Settings' });
  return {
    title: `${t('project_management')} | UnitTCMS`,
    robots: { index: false, follow: false },
  };
}

export default function Page({ params }: { params: { projectId: string; locale: string } }) {
  const t = useTranslations('Settings');
  const messages: SettingsMessages = {
    projectManagement: t('project_management'),
    projectName: t('project_name'),
    projectDetail: t('project_detail'),
    projectOwner: t('project_owner'),
    editProject: t('edit_project'),
    public: t('public'),
    publicity: t('publicity'),
    private: t('private'),
    deleteProject: t('delete_project'),
    delete: t('delete'),
    close: t('close'),
    areYouSure: t('are_you_sure'),
    tagManagement: t('tag_management'),
    tagName: t('tag_name'),
    addTag: t('add_tag'),
    noTagsAvailable: t('no_tags_available'),
    deleteTag: t('delete_tag'),
    areYouSureDeleteTag: t('are_you_sure_delete_tag'),
    tagCreated: t('tag_created'),
    tagUpdated: t('tag_updated'),
    tagDeleted: t('tag_deleted'),
    tagErrorEmpty: t('tag_error_empty'),
    tagErrorMinLength: t('tag_error_min_length'),
    tagErrorMaxLength: t('tag_error_max_length'),
    tagErrorCreate: t('tag_error_create'),
    tagErrorUpdate: t('tag_error_update'),
    tagErrorDelete: t('tag_error_delete'),
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

  const pt = useTranslations('ProjectDialog');
  const projectDialogMessages: ProjectDialogMessages = {
    project: pt('project'),
    projectName: pt('project_name'),
    projectDetail: pt('project_detail'),
    public: pt('public'),
    private: pt('private'),
    ifYouMakePublic: pt('if_you_make_public'),
    close: pt('close'),
    create: pt('create'),
    update: pt('update'),
    pleaseEnter: pt('please_enter'),
  };

  return (
    <>
      <SettingsPage
        projectId={params.projectId}
        messages={messages}
        stageMessages={stageMessages}
        projectDialogMessages={projectDialogMessages}
        locale={params.locale}
      />
    </>
  );
}
