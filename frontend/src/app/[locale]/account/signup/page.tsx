import { getTranslations } from 'next-intl/server';
import AuthPage from '../authPage';
import SignupClosed from './SignupClosed';
import { PageType } from '@/types/base';
import { LocaleCodeType } from '@/types/locale';
import { fetchSignupEnabled } from '@/utils/signupAvailable';

export async function generateMetadata({ params: { locale } }: { params: { locale: LocaleCodeType } }) {
  const t = await getTranslations({ locale, namespace: 'Auth' });
  return {
    title: `${t('signup')} | UnitTCMS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: PageType) {
  const t = await getTranslations('Auth');
  const messages = {
    title: t('signup'),
    linkTitle: t('or_signin'),
    submitTitle: t('signup'),
    signInAsGuest: t('signin_as_guest'),
    signInWithSso: t('signin_with_sso'),
    or: t('or_sso'),
    email: t('email'),
    username: t('username'),
    password: t('password'),
    confirmPassword: t('confirm_password'),
    invalidEmail: t('invalid_email'),
    invalidPassword: t('invalid_password'),
    usernameEmpty: t('username_empty'),
    passwordDoesNotMatch: t('password_not_match'),
    EmailAlreadyExist: t('email_already_exist'),
    emailNotExist: t('email_not_exist'),
    signupError: t('signup_error'),
    signinError: t('signin_error'),
    demoPageWarning: t('demo_page_warning'),
  };
  // Fermée, la page ne montre pas un formulaire qui rendrait 403 : elle dit
  // que la porte est close et renvoie vers la connexion.
  if (!(await fetchSignupEnabled())) {
    return (
      <SignupClosed
        title={t('signup_closed')}
        detail={t('signup_closed_detail')}
        linkTitle={t('or_signin')}
        locale={params.locale as LocaleCodeType}
      />
    );
  }

  return (
    <>
      <AuthPage
        isSignup={true}
        messages={messages}
        locale={params.locale as LocaleCodeType}
        ssoEnabled={false}
        signupEnabled={true}
      />
    </>
  );
}
