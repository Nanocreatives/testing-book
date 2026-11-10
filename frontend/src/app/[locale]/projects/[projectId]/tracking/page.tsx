import { getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import TrackingPage from './TrackingPage';
import { LocaleCodeType } from '@/types/locale';
import { TrackingMessages } from '@/types/tracking';

export async function generateMetadata({ params: { locale } }: { params: { locale: LocaleCodeType } }) {
  const t = await getTranslations({ locale, namespace: 'Tracking' });
  return {
    title: `${t('title')} | UnitTCMS`,
    robots: { index: false, follow: false },
  };
}

export default function Page({ params }: { params: { projectId: string } }) {
  const t = useTranslations('Tracking');
  const m = useTranslations('Members');

  const messages: TrackingMessages = {
    title: t('title'),
    subtitle: t('subtitle'),
    overall: t('overall'),
    byMember: t('by_member'),
    byRole: t('by_role'),
    campaign: t('campaign'),
    cases: t('cases'),
    played: t('played'),
    settled: t('settled'),
    settledHint: t('settled_hint'),
    disagreeing: t('disagreeing'),
    disagreeingHint: t('disagreeing_hint'),
    awaiting: t('awaiting'),
    member: t('member'),
    role: t('role'),
    membersCount: t('members_count'),
    coverage: t('coverage'),
    coverageHint: t('coverage_hint'),
    agreement: t('agreement'),
    notComparable: t('not_comparable'),
    notComparableHint: t('not_comparable_hint'),
    remaining: t('remaining'),
    noData: t('no_data'),
    manager: m('manager'),
    developer: m('developer'),
    reporter: m('reporter'),
  };

  return <TrackingPage projectId={params.projectId} messages={messages} />;
}
