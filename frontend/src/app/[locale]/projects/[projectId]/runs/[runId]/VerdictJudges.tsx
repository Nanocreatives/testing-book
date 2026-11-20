import { Tooltip } from '@heroui/react';
import { TriangleAlert } from 'lucide-react';
import RunCaseStatus, { runCaseStatusColor, runCaseStatusTint } from './RunCaseStatus';
import { testRunCaseStatus } from '@/config/selection';
import { RunCaseVerdictType } from '@/types/case';
import { TestRunCaseStatusMessages, TestRunCaseStatusUidType } from '@/types/status';
import { initialsOf, orderJudges, judgesDisagree } from '@/utils/verdictJudges';

type Props = {
  verdicts: RunCaseVerdictType[];
  viewerId: number | null;
  statusMessages: TestRunCaseStatusMessages;
  judgedByLabel: string;
  youLabel: string;
  divergeLabel: string;
  unknownLabel: string;
};

/** Deux pastilles tiennent dans la colonne ; au-delà, un compte et l'infobulle. */
const SHOWN = 2;

const uidOf = (status: number): TestRunCaseStatusUidType => testRunCaseStatus[status]?.uid ?? 'untested';

/**
 * Qui a jugé ce cas, et quoi.
 *
 * Un statut sans son auteur n'est qu'une rumeur : la personne suivante doit
 * pouvoir décider de s'y fier ou de rejouer le cas, et pour ça savoir si elle
 * s'est déjà prononcée elle-même.
 */
export default function VerdictJudges({
  verdicts,
  viewerId,
  statusMessages,
  judgedByLabel,
  youLabel,
  divergeLabel,
  unknownLabel,
}: Props) {
  if (verdicts.length === 0) {
    return null;
  }

  const ordered = orderJudges(verdicts, viewerId);
  const diverge = judgesDisagree(verdicts);
  const shown = ordered.slice(0, SHOWN);
  const hidden = ordered.length - shown.length;

  const nameOf = (verdict: RunCaseVerdictType) => {
    const name = verdict.username || unknownLabel;
    return verdict.userId !== null && verdict.userId === viewerId ? `${name} (${youLabel})` : name;
  };
  const lineOf = (verdict: RunCaseVerdictType) => `${nameOf(verdict)} — ${statusMessages[uidOf(verdict.status)]}`;

  return (
    <Tooltip
      placement="top-start"
      content={
        <div className="max-w-xs py-1">
          <p className="text-tiny font-medium text-default-500">{judgedByLabel}</p>
          <ul className="mt-1 flex flex-col gap-1">
            {ordered.map((verdict, index) => (
              <li key={verdict.userId ?? `unknown-${index}`} className="flex items-center gap-1.5 text-tiny">
                <RunCaseStatus uid={uidOf(verdict.status)} />
                <span className="font-medium">{nameOf(verdict)}</span>
                <span className="text-default-500">{statusMessages[uidOf(verdict.status)]}</span>
              </li>
            ))}
          </ul>
          {diverge && <p className="mt-1.5 text-tiny text-warning-600">{divergeLabel}</p>}
        </div>
      }
    >
      <button
        type="button"
        aria-label={`${judgedByLabel} : ${ordered.map(lineOf).join(', ')}${diverge ? ` — ${divergeLabel}` : ''}`}
        className="flex items-center gap-0.5 rounded-small p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {shown.map((verdict, index) => (
          <span
            key={verdict.userId ?? `unknown-${index}`}
            // Son propre avis se repère sans lire : en tête, et au trait épais.
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-zinc-800 ${
              verdict.userId !== null && verdict.userId === viewerId ? 'border-2' : 'border'
            }`}
            style={{
              backgroundColor: runCaseStatusTint[uidOf(verdict.status)],
              borderColor: runCaseStatusColor[uidOf(verdict.status)],
            }}
          >
            {initialsOf(verdict.username)}
          </span>
        ))}
        {hidden > 0 && <span className="text-tiny text-default-500">+{hidden}</span>}
        {diverge && <TriangleAlert size={12} className="text-warning shrink-0" />}
      </button>
    </Tooltip>
  );
}
