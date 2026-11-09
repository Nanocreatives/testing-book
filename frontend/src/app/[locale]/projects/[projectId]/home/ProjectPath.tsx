'use client';
import { useContext, useEffect, useState } from 'react';
import { Button, Card, CardBody, Chip, Progress, Skeleton, Tooltip, addToast } from '@heroui/react';
import { BookOpen, Check, FlaskConical, Lock } from 'lucide-react';
import { useRouter } from '@/src/i18n/routing';
import { TokenContext } from '@/utils/TokenProvider';
import { completeStage, fetchStages } from '@/utils/stagesControl';
import { StageMessages, StageType } from '@/types/stage';
import { stageKinds } from '@/config/selection';
import { subtitle } from '@/components/primitives';
import { logError } from '@/utils/errorHandler';

const BRIEFING_KIND = stageKinds.findIndex((kind) => kind.uid === 'briefing');

type Props = {
  projectId: string;
  locale: string;
  messages: StageMessages;
  isManager: boolean;
};

export default function ProjectPath({ projectId, locale, messages, isManager }: Props) {
  const context = useContext(TokenContext);
  const router = useRouter();
  const [stages, setStages] = useState<StageType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);

  useEffect(() => {
    async function fetchDataEffect() {
      if (!context.isSignedIn()) {
        return;
      }

      try {
        setStages(await fetchStages(context.token.access_token, projectId));
      } catch (error: unknown) {
        logError('Error fetching stages:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDataEffect();
  }, [context, projectId]);

  const onAcknowledge = async (stage: StageType) => {
    if (acknowledgingId) {
      return;
    }

    setAcknowledgingId(stage.id);
    try {
      await completeStage(context.token.access_token, stage.id);
      setStages(await fetchStages(context.token.access_token, projectId));
    } catch (error: unknown) {
      addToast({ title: 'Error', color: 'danger', description: messages.stageError });
      logError('Error completing stage:', error);
    } finally {
      setAcknowledgingId(null);
    }
  };

  if (isLoading) {
    return <Skeleton className="mt-6 h-24 w-full rounded-medium" />;
  }

  if (stages.length === 0) {
    // Nothing to say to a reporter: a project without a path simply has none.
    if (!isManager) {
      return null;
    }

    return (
      <Card className="mt-6" shadow="none">
        <CardBody>
          <p className="font-bold">{messages.noPath}</p>
          <p className="mt-1 text-small text-default-600">{messages.noPathHint}</p>
        </CardBody>
      </Card>
    );
  }

  // The stage everyone is told to work on next, and the one named as the reason
  // everything after it is out of reach.
  const current = stages.find((stage) => !stage.isDone);

  return (
    <div className="mt-8">
      <h2 className={subtitle()}>{messages.path}</h2>
      <p className="-mt-2 mb-3 text-small text-default-600">{messages.pathIntro}</p>

      <div className="flex flex-col gap-2">
        {stages.map((stage, index) => {
          const isBriefing = stage.kind === BRIEFING_KIND;
          const isCurrent = current ? stage.id === current.id : false;
          // A manager has to be able to walk their own path to set it up, so the
          // lock is shown to them but never applied.
          const isBlocked = stage.isLocked && !isManager;
          const lockReason = current ? `${messages.lockedBecause} ${current.title}` : messages.locked;

          return (
            <Card
              key={stage.id}
              shadow="none"
              className={`border-medium ${isCurrent ? 'border-primary' : 'border-default-200'} ${
                stage.isLocked ? 'opacity-60' : ''
              }`}
            >
              <CardBody className="flex-row items-start gap-3">
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-default-100">
                  {stage.isDone ? (
                    <Check size={14} className="text-success" />
                  ) : stage.isLocked ? (
                    <Lock size={14} className="text-default-500" />
                  ) : (
                    <span className="text-tiny font-bold">{index + 1}</span>
                  )}
                </div>

                <div className="min-w-0 flex-grow">
                  <div className="flex items-center gap-2">
                    {isBriefing ? <BookOpen size={16} /> : <FlaskConical size={16} />}
                    <span className="font-bold">{stage.title}</span>
                    {stage.isDone && (
                      <Chip size="sm" variant="flat" color="success">
                        {messages.done}
                      </Chip>
                    )}
                  </div>

                  {isBriefing && stage.content && !stage.isLocked && (
                    <p className="mt-2 whitespace-pre-wrap text-small">{stage.content}</p>
                  )}

                  {!isBriefing && stage.caseTotal !== null && (
                    <div className="mt-2 max-w-sm">
                      <Progress
                        size="sm"
                        aria-label={stage.title}
                        value={stage.caseSettled ?? 0}
                        maxValue={stage.caseTotal || 1}
                        color={stage.isDone ? 'success' : 'primary'}
                      />
                      <p className="mt-1 text-tiny text-default-600">
                        {stage.caseSettled} / {stage.caseTotal} {messages.casesSettled}
                      </p>
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  <Tooltip content={lockReason} isDisabled={!stage.isLocked}>
                    <div>
                      {isBriefing ? (
                        !stage.isDone && (
                          <Button
                            size="sm"
                            color={isCurrent ? 'primary' : 'default'}
                            isDisabled={isBlocked}
                            isLoading={acknowledgingId === stage.id}
                            onPress={() => onAcknowledge(stage)}
                          >
                            {messages.markAsRead}
                          </Button>
                        )
                      ) : (
                        <Button
                          size="sm"
                          color={isCurrent ? 'primary' : 'default'}
                          variant={isCurrent ? 'solid' : 'bordered'}
                          isDisabled={isBlocked || !stage.runId}
                          onPress={() => router.push(`/projects/${projectId}/runs/${stage.runId}`, { locale: locale })}
                        >
                          {messages.openRun}
                        </Button>
                      )}
                    </div>
                  </Tooltip>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
