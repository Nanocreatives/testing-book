import { useContext, useEffect, useState } from 'react';
import {
  addToast,
  Button,
  Card,
  CardBody,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectItem,
  Textarea,
} from '@heroui/react';
import { ArrowDown, ArrowUp, BookOpen, Check, FlaskConical, Pencil, Plus, Trash2, X } from 'lucide-react';
import { fetchRuns } from '../runs/runsControl';
import { StageMessages, StageType } from '@/types/stage';
import { RunType } from '@/types/run';
import { TokenContext } from '@/utils/TokenProvider';
import { createStage, deleteStage, fetchStages, reorderStages, updateStage } from '@/utils/stagesControl';
import { stageKinds } from '@/config/selection';
import { logError } from '@/utils/errorHandler';

const BRIEFING_KIND = stageKinds.findIndex((kind) => kind.uid === 'briefing');
const RUN_KIND = stageKinds.findIndex((kind) => kind.uid === 'run');

type Props = {
  projectId: string;
  messages: StageMessages;
};

type DraftType = {
  kind: number;
  title: string;
  content: string;
  runId: number | null;
};

const emptyDraft: DraftType = { kind: BRIEFING_KIND, title: '', content: '', runId: null };

export default function ProjectStagesManager({ projectId, messages }: Props) {
  const context = useContext(TokenContext);
  const [stages, setStages] = useState<StageType[]>([]);
  const [runs, setRuns] = useState<RunType[]>([]);
  const [draft, setDraft] = useState<DraftType | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [openPopoverStageId, setOpenPopoverStageId] = useState<number | null>(null);

  useEffect(() => {
    async function fetchDataEffect() {
      if (!context.isSignedIn()) {
        return;
      }

      try {
        setStages(await fetchStages(context.token.access_token, projectId));
        setRuns((await fetchRuns(context.token.access_token, Number(projectId))) || []);
      } catch (error: unknown) {
        logError('Error fetching stages:', error);
      }
    }

    fetchDataEffect();
  }, [context, projectId]);

  const reload = async () => {
    setStages(await fetchStages(context.token.access_token, projectId));
  };

  const validate = (candidate: DraftType) => {
    if (!candidate.title.trim()) {
      return messages.stageErrorTitle;
    }
    if (candidate.kind === RUN_KIND && !candidate.runId) {
      return messages.stageErrorRun;
    }
    return '';
  };

  const onSubmitDraft = async () => {
    if (!draft) {
      return;
    }

    const error = validate(draft);
    if (error) {
      addToast({ title: 'Error', color: 'danger', description: error });
      return;
    }

    try {
      if (editingId) {
        await updateStage(context.token.access_token, editingId, {
          title: draft.title,
          content: draft.content,
          runId: draft.runId,
        });
      } else {
        await createStage(context.token.access_token, projectId, draft);
      }
      await reload();
      setDraft(null);
      setEditingId(null);
      addToast({
        title: 'Success',
        color: 'success',
        description: editingId ? messages.stageUpdated : messages.stageCreated,
      });
    } catch (error: unknown) {
      addToast({ title: 'Error', color: 'danger', description: messages.stageError });
      logError('Error saving stage:', error);
    }
  };

  const onDelete = async (stageId: number) => {
    try {
      await deleteStage(context.token.access_token, stageId);
      setOpenPopoverStageId(null);
      await reload();
      addToast({ title: 'Success', color: 'success', description: messages.stageDeleted });
    } catch (error: unknown) {
      addToast({ title: 'Error', color: 'danger', description: messages.stageError });
      logError('Error deleting stage:', error);
    }
  };

  const onMove = async (index: number, offset: number) => {
    const reordered = [...stages];
    const target = index + offset;
    if (target < 0 || target >= reordered.length) {
      return;
    }
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    // Shown before the call: the arrows are clicked in bursts, and waiting for
    // a round trip between two of them makes the list feel broken.
    setStages(reordered);
    try {
      await reorderStages(
        context.token.access_token,
        projectId,
        reordered.map((stage) => stage.id)
      );
      await reload();
    } catch (error: unknown) {
      await reload();
      addToast({ title: 'Error', color: 'danger', description: messages.stageError });
      logError('Error reordering stages:', error);
    }
  };

  const startEditing = (stage: StageType) => {
    setEditingId(stage.id);
    setDraft({
      kind: stage.kind,
      title: stage.title,
      content: stage.content ?? '',
      runId: stage.runId,
    });
  };

  const renderForm = () => {
    if (!draft) {
      return null;
    }

    return (
      <Card shadow="none" className="border-medium border-primary">
        <CardBody className="gap-3">
          <Input
            size="sm"
            variant="bordered"
            label={messages.stageTitle}
            value={draft.title}
            onValueChange={(value) => setDraft({ ...draft, title: value })}
          />

          {draft.kind === BRIEFING_KIND ? (
            <Textarea
              size="sm"
              variant="bordered"
              minRows={4}
              label={messages.stageContent}
              placeholder={messages.stageContentPlaceholder}
              value={draft.content}
              onValueChange={(value) => setDraft({ ...draft, content: value })}
            />
          ) : (
            <Select
              size="sm"
              variant="bordered"
              label={messages.pickRun}
              selectedKeys={draft.runId ? [String(draft.runId)] : []}
              onSelectionChange={(keys) => {
                const picked = Array.from(keys)[0];
                setDraft({ ...draft, runId: picked ? Number(picked) : null });
              }}
            >
              {runs.map((run) => (
                <SelectItem key={String(run.id)}>{run.name}</SelectItem>
              ))}
            </Select>
          )}

          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="light"
              startContent={<X size={16} />}
              onPress={() => {
                setDraft(null);
                setEditingId(null);
              }}
            >
              {messages.cancel}
            </Button>
            <Button size="sm" color="primary" startContent={<Check size={16} />} onPress={onSubmitDraft}>
              {messages.save}
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {stages.length === 0 && !draft && <p className="text-small text-default-600">{messages.noPathHint}</p>}

      {stages.map((stage, index) => {
        if (editingId === stage.id) {
          return <div key={stage.id}>{renderForm()}</div>;
        }

        return (
          <Card key={stage.id} shadow="none" className="border-medium border-default-200">
            <CardBody className="flex-row items-center gap-3">
              <span className="text-tiny font-bold text-default-500">{index + 1}</span>
              {stage.kind === BRIEFING_KIND ? <BookOpen size={16} /> : <FlaskConical size={16} />}
              <div className="min-w-0 flex-grow">
                <p className="truncate font-bold">{stage.title}</p>
                <p className="truncate text-tiny text-default-600">
                  {stage.kind === BRIEFING_KIND ? messages.briefing : (stage.runName ?? messages.run)}
                </p>
              </div>

              <Button
                isIconOnly
                size="sm"
                variant="light"
                aria-label={messages.moveUp}
                isDisabled={index === 0}
                onPress={() => onMove(index, -1)}
              >
                <ArrowUp size={16} />
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                aria-label={messages.moveDown}
                isDisabled={index === stages.length - 1}
                onPress={() => onMove(index, 1)}
              >
                <ArrowDown size={16} />
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                aria-label={messages.edit}
                onPress={() => startEditing(stage)}
              >
                <Pencil size={16} />
              </Button>

              <Popover
                isOpen={openPopoverStageId === stage.id}
                onOpenChange={(isOpen) => setOpenPopoverStageId(isOpen ? stage.id : null)}
              >
                <PopoverTrigger>
                  <Button isIconOnly size="sm" variant="light" color="danger" aria-label={messages.delete}>
                    <Trash2 size={16} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-3">
                  <p className="text-small">{messages.areYouSureDeleteStage}</p>
                  <Button size="sm" color="danger" className="mt-2 w-full" onPress={() => onDelete(stage.id)}>
                    {messages.delete}
                  </Button>
                </PopoverContent>
              </Popover>
            </CardBody>
          </Card>
        );
      })}

      {!editingId && renderForm()}

      {!draft && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="bordered"
            startContent={<Plus size={16} />}
            onPress={() => setDraft({ ...emptyDraft, kind: BRIEFING_KIND })}
          >
            {messages.addBriefing}
          </Button>
          <Button
            size="sm"
            variant="bordered"
            startContent={<Plus size={16} />}
            onPress={() => setDraft({ ...emptyDraft, kind: RUN_KIND })}
          >
            {messages.addRun}
          </Button>
        </div>
      )}
    </div>
  );
}
