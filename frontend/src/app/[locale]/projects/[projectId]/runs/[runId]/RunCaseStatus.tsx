import { Circle, CircleCheck, CircleDashed, CircleX, CircleSlash2 } from 'lucide-react';

type Props = {
  uid: string;
};

/** Une couleur par statut, partagée par l'icône et par les pastilles d'auteur. */
export const runCaseStatusColor: Record<string, string> = {
  untested: '#d4d4d8',
  passed: '#17c964',
  retest: '#f5a524',
  failed: '#f31260',
  skipped: '#52525b',
};

// Le fond d'une pastille d'auteur : assez clair pour que des initiales
// sombres s'y lisent, la couleur pleine restant pour le contour.
export const runCaseStatusTint: Record<string, string> = {
  untested: '#f4f4f5',
  passed: '#d7f8e4',
  retest: '#fdf0d5',
  failed: '#ffe0e6',
  skipped: '#e4e4e7',
};

export default function RunCaseStatus({ uid }: Props) {
  if (uid === 'untested') {
    return <Circle size={16} color={runCaseStatusColor.untested} />;
  } else if (uid === 'passed') {
    return <CircleCheck size={16} color={runCaseStatusColor.passed} />;
  } else if (uid === 'retest') {
    return <CircleDashed size={16} color={runCaseStatusColor.retest} />;
  } else if (uid === 'failed') {
    return <CircleX size={16} color={runCaseStatusColor.failed} />;
  } else if (uid === 'skipped') {
    return <CircleSlash2 size={16} color={runCaseStatusColor.skipped} />;
  }
}
