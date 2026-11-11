'use client';
import { useState, useEffect, useContext } from 'react';
import {
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Tooltip,
  Divider,
  Selection,
  DropdownTrigger,
  Dropdown,
  DropdownMenu,
  DropdownItem,
  addToast,
  Badge,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@heroui/react';
import {
  Save,
  ArrowLeft,
  ChevronDown,
  CopyPlus,
  CopyMinus,
  RotateCw,
  FileDown,
  FileSpreadsheet,
  FileCode,
  FileJson,
  ChevronRight,
  Folder,
  Filter,
  Lock,
  UserCog,
  ListFilter,
  FlaskConical,
  Users,
  ListTodo,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { NodeApi, Tree } from 'react-arborist';
import { usePathname } from 'next/navigation';
import {
  fetchRun,
  fetchRuns,
  updateRun,
  updateRunCases,
  fetchProjectCases,
  includeExcludeTestCases,
  changeStatus,
  exportRun,
  assignRunCases,
  fetchProjectMembersForRun,
  fetchRunGate,
  updateCasesRole,
} from '../runsControl';
import { fetchFolders } from '../../folders/foldersControl';
import RunProgressChart from './RunPregressDonutChart';
import TestCaseSelector from './TestCaseSelector';
import AssigneePicker from './AssigneePicker';
import TestRunFilter from './TestRunFilter';
import { useRouter } from '@/src/i18n/routing';
import { testRunStatus, memberRoles } from '@/config/selection';
import { RunType, RunStatusCountType, RunMessages, RunGateType } from '@/types/run';
import { StageType } from '@/types/stage';
import { CaseType } from '@/types/case';
import { TreeNodeData } from '@/types/folder';
import { TokenContext } from '@/utils/TokenProvider';
import { fetchStages } from '@/utils/stagesControl';
import { useFormGuard } from '@/utils/formGuard';
import { PriorityMessages } from '@/types/priority';
import { RunStatusMessages, TestRunCaseStatusMessages } from '@/types/status';
import { TestTypeMessages } from '@/types/testType';
import { MemberType } from '@/types/user';
import { logError } from '@/utils/errorHandler';
import TreeItem from '@/components/TreeItem';
import { buildFolderTree } from '@/utils/buildFolderTree';
import { isCaseInRun, pruneFoldersToCases } from '@/utils/runCaseScope';

const defaultTestRun = {
  id: 0,
  name: '',
  configurations: 0,
  description: '',
  instructions: null,
  state: 0,
  projectId: 0,
  createdAt: '',
  updatedAt: '',
};

type Props = {
  projectId: string;
  runId: string;
  messages: RunMessages;
  runStatusMessages: RunStatusMessages;
  testRunCaseStatusMessages: TestRunCaseStatusMessages;
  priorityMessages: PriorityMessages;
  testTypeMessages: TestTypeMessages;
  locale: string;
};

export default function RunEditor({
  projectId,
  runId,
  messages,
  runStatusMessages,
  testRunCaseStatusMessages,
  priorityMessages,
  testTypeMessages,
  locale,
}: Props) {
  const tokenContext = useContext(TokenContext);
  const { theme } = useTheme();
  const [testRun, setTestRun] = useState<RunType>(defaultTestRun);
  const [treeData, setTreeData] = useState<TreeNodeData[]>([]);
  // Entrer dans une campagne, c'est venir jouer SES cas. Les autres ne sont
  // montrés que si on vient en composer une, ce que seul un rapporteur peut.
  const [onlyRunCases, setOnlyRunCases] = useState<boolean>(true);
  const [siblingRuns, setSiblingRuns] = useState<RunType[]>([]);
  const [runStatusCounts, setRunStatusCounts] = useState<RunStatusCountType[]>([]);
  // Le désaccord n'est PAS un sixième statut : un cas dont les avis divergent
  // est déjà compté sous son statut agrégé. Le mettre en tranche le retirerait
  // des échecs — donc il se lit à côté du camembert, pas dedans.
  const [disagreeing, setDisagreeing] = useState<number>(0);
  const [awaitingVerdicts, setAwaitingVerdicts] = useState<number>(0);
  // Ce qui reste à CETTE personne. Le total de la campagne ne le dit pas, et
  // c'est pourtant le seul nombre qui lui dise quoi faire.
  const [yoursToPlay, setYoursToPlay] = useState<number>(0);
  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set([]));
  const [selectedFolder, setSelectedFolder] = useState<TreeNodeData | null>(null);
  const [testCases, setTestCases] = useState<CaseType[]>([]);
  const [filteredTestCases, setFilteredTestCases] = useState<CaseType[]>([]);
  const [isNameInvalid] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<number[]>([]);
  const [tagFilter, setTagFilter] = useState<number[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');
  const [members, setMembers] = useState<MemberType[]>([]);
  const [pendingAssignees, setPendingAssignees] = useState<Map<number, number | null>>(new Map());
  const [blockingStage, setBlockingStage] = useState<StageType | null>(null);
  const [gate, setGate] = useState<RunGateType>({ role: null, blocking: [], blockedCaseIds: [], reporterBlocking: [] });
  const router = useRouter();
  const pathname = usePathname();
  const isManager = tokenContext.isProjectManager(Number(projectId));

  // The path may put this run behind stages the reporter has not cleared. A
  // manager is never held back: they are the one who set the path up.
  useEffect(() => {
    async function fetchPathEffect() {
      if (!tokenContext.isSignedIn() || isManager) {
        setBlockingStage(null);
        return;
      }

      const stages = await fetchStages(tokenContext.token.access_token, projectId);
      const stage = stages.find((entry) => entry.runId === Number(runId));
      setBlockingStage(stage && stage.isLocked ? (stages.find((entry) => !entry.isDone) ?? null) : null);
    }

    fetchPathEffect();
  }, [tokenContext, projectId, runId, isManager]);

  const isLocked = blockingStage !== null;

  const ownerRoleLabel = (ownerRole: number) => {
    const uid = memberRoles[ownerRole] ? memberRoles[ownerRole].uid : '';
    if (uid === 'manager') return messages.roleManager;
    if (uid === 'developer') return messages.roleDeveloper;
    if (uid === 'reporter') return messages.roleReporter;
    return messages.ownerEveryone;
  };

  // One array rather than an item followed by a map: the menu takes a single
  // collection, and the two forms do not add up.
  const ownerRoleOptions: { key: string; label: string; value: number | null }[] = [
    { key: 'everyone', label: messages.ownerEveryone, value: null },
    ...memberRoles.map((role, index) => ({ key: role.uid, label: ownerRoleLabel(index), value: index })),
  ];

  const handleBulkOwnerRole = async (ownerRole: number | null) => {
    const ids =
      selectedKeys === 'all' ? filteredTestCases.map((entry) => entry.id) : Array.from(selectedKeys).map(Number);
    if (ids.length === 0) {
      return;
    }

    try {
      await updateCasesRole(tokenContext.token.access_token, Number(projectId), ids, ownerRole);
      await initTestCases();
      setGate(await fetchRunGate(tokenContext.token.access_token, Number(runId)));
      setSelectedKeys(new Set([]));
      addToast({ title: 'Success', color: 'success', description: messages.roleUpdated });
    } catch (error: unknown) {
      addToast({ title: 'Error', color: 'danger', description: messages.roleUpdateFailed });
      logError('Error updating case roles:', error);
    }
  };

  // not show warning when navigating to test case detail page
  useFormGuard(isDirty, messages.areYouSureLeave, [`/projects/${projectId}/runs/${runId}/cases/\\d+`]);

  const fetchRunAndStatusCount = async () => {
    const {
      run,
      statusCounts,
      disagreeing: diverging,
      awaitingVerdicts: pending,
      yoursToPlay: mine,
    } = await fetchRun(tokenContext.token.access_token, Number(runId));
    setTestRun(run);
    setRunStatusCounts(statusCounts);
    setDisagreeing(diverging ?? 0);
    setAwaitingVerdicts(pending ?? 0);
    setYoursToPlay(mine ?? 0);
    setGate(await fetchRunGate(tokenContext.token.access_token, Number(runId)));
  };

  const initTestCases = async (search?: string, status?: string[], tag?: string[], assignee?: string) => {
    const casesData = await fetchProjectCases(
      tokenContext.token.access_token,
      Number(projectId),
      Number(runId),
      search,
      status,
      tag,
      assignee
    );
    casesData.forEach((testCase: CaseType) => {
      if (testCase.RunCases && testCase.RunCases.length > 0) {
        testCase.RunCases[0].editState = 'notChanged';
      }
    });
    setTestCases(casesData);
  };

  const isSignedIn = tokenContext.isSignedIn();
  useEffect(() => {
    if (!isSignedIn) return;

    async function fetchDataEffect() {
      if (!tokenContext.isSignedIn()) {
        return;
      }

      try {
        await fetchRunAndStatusCount();
        const foldersData = await fetchFolders(tokenContext.token.access_token, Number(projectId));
        setTreeData(buildFolderTree(foldersData));
        initTestCases();
        const membersData = await fetchProjectMembersForRun(tokenContext.token.access_token, projectId);
        setMembers(membersData || []);
        const runsData = await fetchRuns(tokenContext.token.access_token, Number(projectId));
        setSiblingRuns(runsData || []);
      } catch (error: unknown) {
        logError('Error fetching run data', error);
      }
    }

    fetchDataEffect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  // Sans dossier choisi, on montrait une liste VIDE : il fallait deviner qu'un
  // clic dans l'arbre était nécessaire. Le périmètre sert donc de repli.
  const scopedCases = onlyRunCases ? testCases.filter(isCaseInRun) : testCases;
  const scopedTree = onlyRunCases ? pruneFoldersToCases(treeData, scopedCases) : treeData;

  useEffect(() => {
    try {
      const inScope = onlyRunCases ? testCases.filter(isCaseInRun) : testCases;
      setFilteredTestCases(
        selectedFolder?.id ? inScope.filter((testCase) => testCase.folderId.toString() === selectedFolder.id) : inScope
      );
    } catch (error: unknown) {
      logError('Error filtering test cases', error);
    }
  }, [selectedFolder, testCases, onlyRunCases]);

  // `replace` et non `push` : la route nue n'a aucun intérêt dans l'historique,
  // et y revenir par le bouton Retour relancerait la redirection en boucle.
  useEffect(() => {
    if (pathname.includes('/cases/')) return;
    const first = scopedCases[0];
    if (!first) return;
    router.replace(`/projects/${projectId}/runs/${runId}/cases/${first.id}`, { locale: locale });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, scopedCases.length]);

  // Un dossier retenu qui sort du périmètre laisserait la liste vide sans
  // qu'aucun écran ne dise pourquoi.
  useEffect(() => {
    if (!selectedFolder?.id) return;
    const stillPopulated = scopedCases.some((testCase) => testCase.folderId.toString() === selectedFolder.id);
    if (!stillPopulated) {
      setSelectedFolder(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyRunCases]);

  const handleChangeStatus = async (changeCaseId: number, newStatus: number) => {
    setIsDirty(true);
    const newTestCases = changeStatus(changeCaseId, newStatus, testCases);
    setTestCases(newTestCases);
  };

  const handleIncludeExcludeCase = async (isInclude: boolean, clickedTestCaseId: number) => {
    setIsDirty(true);
    const keys = [clickedTestCaseId];
    const newTestCases = includeExcludeTestCases(isInclude, keys, Number(runId), testCases);
    setTestCases(newTestCases);
  };

  const handleBulkIncludeExcludeCases = async (isInclude: boolean) => {
    setIsDirty(true);
    let keys: number[] = [];
    if (selectedKeys === 'all') {
      keys = filteredTestCases.map((item) => item.id);
    } else {
      keys = Array.from(selectedKeys).map(Number);
    }

    const newTestCases = includeExcludeTestCases(isInclude, keys, Number(runId), testCases);
    setTestCases(newTestCases);
    setSelectedKeys(new Set([]));
  };

  const handleAssignCase = (runCaseId: number, userId: number | null) => {
    setIsDirty(true);
    setTestCases((current) =>
      current.map((tc) => {
        if (tc.RunCases && tc.RunCases[0]?.id === runCaseId) {
          return { ...tc, RunCases: [{ ...tc.RunCases[0], assigneeUserId: userId }] };
        }
        return tc;
      })
    );
    setPendingAssignees((prev) => new Map(prev).set(runCaseId, userId));
  };

  const handleBulkAssignCases = (userId: number | null) => {
    let keys: number[] = [];
    if (selectedKeys === 'all') {
      keys = filteredTestCases.map((item) => item.id);
    } else {
      keys = Array.from(selectedKeys).map(Number);
    }

    const runCaseIds = keys
      .map((caseId) => {
        const tc = testCases.find((t) => t.id === caseId);
        return tc?.RunCases?.[0]?.id;
      })
      .filter((id): id is number => typeof id === 'number' && id > 0);

    if (runCaseIds.length === 0) return;

    setIsDirty(true);
    setTestCases((current) =>
      current.map((tc) => {
        if (tc.RunCases?.[0] && runCaseIds.includes(tc.RunCases[0].id)) {
          return { ...tc, RunCases: [{ ...tc.RunCases[0], assigneeUserId: userId }] };
        }
        return tc;
      })
    );
    setPendingAssignees((prev) => {
      const next = new Map(prev);
      runCaseIds.forEach((id) => next.set(id, userId));
      return next;
    });
    // Defer clearing selection so the picker dropdown finishes closing before unmounting
    setTimeout(() => setSelectedKeys(new Set([])), 0);
  };

  const onSave = async () => {
    setIsUpdating(true);
    try {
      await updateRun(tokenContext.token.access_token, testRun);
      await updateRunCases(tokenContext.token.access_token, Number(runId), testCases);

      if (pendingAssignees.size > 0) {
        const grouped = new Map<number | null, number[]>();
        pendingAssignees.forEach((userId, runCaseId) => {
          const existing = grouped.get(userId) ?? [];
          grouped.set(userId, [...existing, runCaseId]);
        });
        for (const [userId, ids] of Array.from(grouped.entries())) {
          await assignRunCases(tokenContext.token.access_token, Number(runId), ids, userId);
        }
        setPendingAssignees(new Map());
      }

      await initTestCases();
      setGate(await fetchRunGate(tokenContext.token.access_token, Number(runId)));

      addToast({
        title: 'Success',
        color: 'success',
        description: messages.updatedTestRun,
      });
      setIsDirty(false);
    } catch (error) {
      logError('Error saving run:', error);
      addToast({
        title: 'Error',
        color: 'danger',
        description: 'Failed to save run. Please try again.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // **************************************************************************
  // Filter
  // **************************************************************************
  const [showFilter, setShowFilter] = useState(false);
  const [activeFilterNum, setActiveFilterNum] = useState(0);

  const onFilterChange = async (search: string, status: number[], tag: number[], assignee?: string) => {
    if (isDirty) {
      addToast({
        title: 'Error',
        color: 'danger',
        description: messages.pleaseSave,
      });
      return;
    }

    const resolvedAssignee = assignee === 'me' ? String(tokenContext.token.user?.id ?? '') : (assignee ?? '');

    setSearchFilter(search);
    setStatusFilter(status);
    setTagFilter(tag);
    setAssigneeFilter(assignee ?? '');
    setActiveFilterNum((search ? 1 : 0) + (status.length > 0 ? 1 : 0) + (tag.length > 0 ? 1 : 0) + (assignee ? 1 : 0));
    await initTestCases(search, status.map(String), tag.map(String), resolvedAssignee || undefined);
  };

  return (
    <>
      <div className="border-b-1 dark:border-neutral-700 w-full p-3 flex items-center justify-between">
        <div className="flex items-center">
          <Tooltip content={messages.backToRuns}>
            <Button
              isIconOnly
              size="sm"
              className="rounded-full bg-neutral-50 dark:bg-neutral-600"
              onPress={() => router.push(`/projects/${projectId}/runs`, { locale: locale })}
            >
              <ArrowLeft size={16} />
            </Button>
          </Tooltip>
          {/* Le nom de la campagne EST le sélecteur : passer de l'une à l'autre
              est le geste le plus fréquent, et repasser par la liste le coupe. */}
          {siblingRuns.length > 1 ? (
            <Dropdown>
              <DropdownTrigger>
                <Button variant="light" className="ms-2 font-bold" endContent={<ChevronDown size={16} />}>
                  {testRun.name}
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label={messages.switchRun} disabledKeys={[String(testRun.id)]}>
                {siblingRuns.map((run) => (
                  <DropdownItem
                    key={String(run.id)}
                    startContent={<FlaskConical size={16} />}
                    onPress={() => router.push(`/projects/${projectId}/runs/${run.id}`, { locale: locale })}
                  >
                    {run.name}
                  </DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>
          ) : (
            <h3 className="font-bold ms-2">{testRun.name}</h3>
          )}
        </div>
        <div className="flex items-center">
          <Popover placement="bottom" isOpen={showFilter} onOpenChange={(open) => setShowFilter(open)}>
            <Badge
              color="danger"
              content={activeFilterNum}
              isInvisible={activeFilterNum === 0}
              shape="circle"
              placement="top-left"
            >
              <PopoverTrigger>
                <Button
                  startContent={<Filter size={16} />}
                  endContent={<ChevronDown size={16} />}
                  size="sm"
                  variant="bordered"
                  className="me-2"
                >
                  {messages.filter}
                </Button>
              </PopoverTrigger>
            </Badge>
            <PopoverContent>
              <TestRunFilter
                messages={messages}
                testRunCaseStatusMessages={testRunCaseStatusMessages}
                activeSearchFilter={searchFilter}
                activeStatusFilters={statusFilter}
                activeTagFilters={tagFilter}
                activeAssigneeFilter={assigneeFilter}
                projectId={projectId}
                members={members}
                onFilterChange={(newTitleFilter, newStatusFilters, newTagFilters, newAssigneeFilter) => {
                  setShowFilter(false);
                  onFilterChange(newTitleFilter, newStatusFilters, newTagFilters, newAssigneeFilter);
                }}
              />
            </PopoverContent>
          </Popover>
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Button
                variant="bordered"
                size="sm"
                className="me-2"
                startContent={<FileDown size={16} />}
                endContent={<ChevronDown size={16} />}
              >
                {messages.export}
              </Button>
            </DropdownTrigger>
            <DropdownMenu disallowEmptySelection aria-label="Export options">
              <DropdownItem
                key="xml"
                startContent={<FileCode size={16} />}
                onPress={() => exportRun(tokenContext.token.access_token, Number(testRun.id), 'xml')}
              >
                xml
              </DropdownItem>
              <DropdownItem
                key="json"
                startContent={<FileJson size={16} />}
                onPress={() => exportRun(tokenContext.token.access_token, Number(testRun.id), 'json')}
              >
                json
              </DropdownItem>
              <DropdownItem
                key="csv"
                startContent={<FileSpreadsheet size={16} />}
                onPress={() => exportRun(tokenContext.token.access_token, Number(testRun.id), 'csv')}
              >
                csv
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
          <Button
            startContent={
              <Badge isInvisible={!isDirty} color="danger" size="sm" content="" shape="circle">
                <Save size={16} />
              </Badge>
            }
            size="sm"
            isDisabled={isLocked || !tokenContext.isProjectReporter(Number(projectId))}
            color="primary"
            isLoading={isUpdating}
            onPress={onSave}
          >
            {isUpdating ? messages.updating : messages.update}
          </Button>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl pt-6 px-6 flex-grow">
        {blockingStage ? (
          <div className="mb-4 flex items-start gap-2 rounded-medium border-medium border-warning-300 bg-warning-50 p-3 dark:bg-warning-100">
            <Lock size={16} className="mt-1 shrink-0" />
            <div>
              <p className="font-bold">{messages.lockedRun}</p>
              <p className="text-small">
                {messages.lockedBecause} {blockingStage.title}
              </p>
            </div>
          </div>
        ) : (
          (gate.blocking.length > 0 || gate.reporterBlocking.length > 0) && (
            <div className="mb-4 flex items-start gap-2 rounded-medium border-medium border-warning-300 bg-warning-50 p-3 dark:bg-warning-100">
              <Lock size={16} className="mt-1 shrink-0" />
              <div className="min-w-0">
                <p className="font-bold">
                  {gate.blocking.length > 0 ? messages.waitingOnOthers : messages.reporterIsBlocked}
                </p>
                <p className="text-small">
                  {gate.blocking.length > 0 ? messages.waitingOnOthersDetail : messages.reporterIsBlockedDetail}
                </p>
                <ul className="mt-2 text-small">
                  {(gate.blocking.length > 0 ? gate.blocking : gate.reporterBlocking).slice(0, 6).map((blocker) => (
                    <li key={blocker.id} className="truncate">
                      {blocker.title} · {ownerRoleLabel(blocker.ownerRole)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        )}

        {/* Ce qui reste à faire passe AVANT l'avancement : un testeur qui arrive
            cherche quoi jouer, pas où en est la campagne. */}
        {yoursToPlay > 0 && (
          <div className="mb-4 flex items-start gap-2 rounded-medium border-medium border-primary-300 bg-primary-50 p-3 dark:bg-primary-100">
            <ListTodo size={16} className="mt-1 shrink-0 text-primary-600" />
            <div className="min-w-0">
              <p className="font-bold">{messages.yoursToPlay.replace('{n}', String(yoursToPlay))}</p>
              <p className="text-small text-default-600">{messages.yoursToPlayHint}</p>
            </div>
          </div>
        )}

        <div className="flex">
          <div>
            <div className="w-96 h-72">
              <div className="flex items-center">
                <h4 className="font-bold">{messages.progress}</h4>
                <Tooltip content={messages.refresh}>
                  <Button
                    isIconOnly
                    size="sm"
                    className="rounded-full bg-transparent ms-1"
                    onPress={fetchRunAndStatusCount}
                  >
                    <RotateCw size={16} />
                  </Button>
                </Tooltip>
              </div>

              <RunProgressChart
                statusCounts={runStatusCounts}
                testRunCaseStatusMessages={testRunCaseStatusMessages}
                theme={theme}
              />
            </div>

            {/* Deux états d'exception : tant qu'ils valent zéro, les afficher
                n'apprendrait rien. Un seul testeur ne peut pas être en
                désaccord avec lui-même. */}
            {(disagreeing > 0 || awaitingVerdicts > 0) && (
              <div className="w-96 rounded-medium border-medium border-default-200 p-3">
                {disagreeing > 0 && (
                  <div className="flex items-start gap-2">
                    <Users size={16} className="mt-1 shrink-0 text-warning-600" />
                    <div className="min-w-0">
                      <p className="font-bold">
                        {messages.disagreeing} · {disagreeing}
                      </p>
                      <p className="text-tiny text-default-600">{messages.disagreeingDetail}</p>
                    </div>
                  </div>
                )}
                {awaitingVerdicts > 0 && (
                  <p className={`text-small text-default-600 ${disagreeing > 0 ? 'mt-2' : ''}`}>
                    {messages.awaitingVerdicts} · {awaitingVerdicts}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex-grow">
            <Input
              size="sm"
              type="text"
              variant="bordered"
              label={messages.title}
              value={testRun.name}
              isInvalid={isNameInvalid}
              errorMessage={isNameInvalid ? messages.pleaseEnter : ''}
              onChange={(e) => {
                setTestRun({ ...testRun, name: e.target.value });
              }}
              className="mt-3"
            />

            <Textarea
              size="sm"
              variant="bordered"
              label={messages.description}
              value={testRun.description}
              onValueChange={(changeValue) => {
                setTestRun({ ...testRun, description: changeValue });
              }}
              className="mt-3"
            />

            {/* How the run must be executed. Managers write it; everyone else
                reads it — a reporter needs the conventions before setting a
                single status, and the edit form is not where they look. */}
            {isManager ? (
              <Textarea
                size="sm"
                variant="bordered"
                label={messages.instructions}
                placeholder={messages.instructionsPlaceholder}
                value={testRun.instructions ?? ''}
                minRows={3}
                onValueChange={(changeValue) => {
                  setTestRun({ ...testRun, instructions: changeValue });
                }}
                className="mt-3"
              />
            ) : (
              testRun.instructions && (
                <div className="mt-3 rounded-medium border-medium border-default-200 p-3">
                  <p className="text-tiny text-default-600">{messages.instructions}</p>
                  <p className="mt-1 text-small whitespace-pre-wrap">{testRun.instructions}</p>
                </div>
              )
            )}

            <div>
              <Select
                size="sm"
                variant="bordered"
                selectedKeys={[testRunStatus[testRun.state].uid]}
                onSelectionChange={(newSelection) => {
                  if (newSelection !== 'all' && newSelection.size !== 0) {
                    const selectedUid = Array.from(newSelection)[0];
                    const index = testRunStatus.findIndex((template) => template.uid === selectedUid);
                    setTestRun({ ...testRun, state: index });
                  }
                }}
                label={messages.status}
                className="mt-3 max-w-xs"
              >
                {testRunStatus.map((status) => (
                  <SelectItem key={status.uid}>{runStatusMessages[status.uid]}</SelectItem>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <Divider className="my-6" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h6 className="h-8 font-bold">{onlyRunCases ? messages.casesInRun : messages.selectTestCase}</h6>
            <span className="text-small text-default-500">{scopedCases.length}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Composer une campagne demande de voir les cas qui n'y sont pas
                encore ; les jouer demande de ne voir qu'elle. */}
            {tokenContext.isProjectReporter(Number(projectId)) && (
              <Button
                size="sm"
                variant="bordered"
                startContent={onlyRunCases ? <ListFilter size={16} /> : <FlaskConical size={16} />}
                onPress={() => {
                  setSelectedKeys(new Set([]));
                  setOnlyRunCases((only) => !only);
                }}
              >
                {onlyRunCases ? messages.showAllProjectCases : messages.showOnlyRunCases}
              </Button>
            )}
            {(selectedKeys === 'all' || selectedKeys.size > 0) && (
              <>
                {isManager && (
                  <AssigneePicker
                    isAvatarOnly={false}
                    assigneeUserId={null}
                    members={members}
                    isDisabled={false}
                    unassignedLabel={messages.unassigned}
                    searchPlaceholder={messages.searchAssignee}
                    triggerLabel={messages.assignSelected}
                    onAssign={(userId) => handleBulkAssignCases(userId)}
                  />
                )}
                {tokenContext.isProjectDeveloper(Number(projectId)) && (
                  <Dropdown>
                    <DropdownTrigger>
                      <Button size="sm" variant="bordered" startContent={<UserCog size={16} />}>
                        {messages.ownerRole}
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="owner role actions">
                      {ownerRoleOptions.map((option) => (
                        <DropdownItem key={option.key} onPress={() => handleBulkOwnerRole(option.value)}>
                          {option.label}
                        </DropdownItem>
                      ))}
                    </DropdownMenu>
                  </Dropdown>
                )}
                <Dropdown>
                  <DropdownTrigger>
                    <Button
                      size="sm"
                      isDisabled={isLocked || !tokenContext.isProjectReporter(Number(projectId))}
                      color="primary"
                      endContent={<ChevronDown size={16} />}
                    >
                      {messages.testCaseSelection}
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="test case select actions">
                    <DropdownItem
                      key="include"
                      startContent={<CopyPlus size={16} />}
                      onPress={() => handleBulkIncludeExcludeCases(true)}
                    >
                      {messages.includeInRun}
                    </DropdownItem>
                    <DropdownItem
                      key="exclude"
                      startContent={<CopyMinus size={16} />}
                      onPress={() => handleBulkIncludeExcludeCases(false)}
                    >
                      {messages.excludeFromRun}
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 flex rounded-small border-2 dark:border-neutral-700 mb-12">
          <div className="w-3/12 border-r-1 dark:border-neutral-700">
            <Tree
              data={scopedTree}
              className="w-full"
              indent={16}
              rowHeight={42}
              overscanCount={5}
              paddingTop={20}
              paddingBottom={20}
              padding={20}
              width="100%"
              openByDefault={false}
              disableDrop={true}
              disableDrag={true}
            >
              {({ node, style }: { node: NodeApi<TreeNodeData>; style: React.CSSProperties }) => (
                <TreeItem
                  style={style}
                  isSelected={selectedFolder ? node.data.id === selectedFolder.id : false}
                  onClick={() => {
                    setSelectedKeys(new Set([]));
                    setSelectedFolder(node.data);
                  }}
                  toggleButton={
                    node.data.children && node.data.children.length > 0 ? (
                      <Button
                        size="sm"
                        className="bg-transparent rounded-full h-6 w-6 min-w-4"
                        isIconOnly
                        onPress={() => node.toggle()}
                      >
                        {node.isOpen ? (
                          <ChevronDown size={20} color="#F7C24E" />
                        ) : (
                          <ChevronRight size={20} color="#F7C24E" />
                        )}
                      </Button>
                    ) : null
                  }
                  icon={<Folder size={20} color="#F7C24E" fill="#F7C24E" />}
                  label={node.data.name}
                />
              )}
            </Tree>
          </div>
          <div className="w-9/12 overflow-x-auto">
            <TestCaseSelector
              projectId={projectId}
              runId={runId}
              locale={locale}
              cases={filteredTestCases}
              isDisabled={isLocked || !tokenContext.isProjectReporter(Number(projectId))}
              blockedCaseIds={gate.blockedCaseIds}
              isManager={isManager}
              members={members}
              selectedKeys={selectedKeys}
              onSelectionChange={setSelectedKeys}
              onChangeStatus={handleChangeStatus}
              onIncludeCase={(includeTestId) => handleIncludeExcludeCase(true, includeTestId)}
              onExcludeCase={(excludeCaseId) => handleIncludeExcludeCase(false, excludeCaseId)}
              onAssignCase={handleAssignCase}
              messages={messages}
              testRunCaseStatusMessages={testRunCaseStatusMessages}
              priorityMessages={priorityMessages}
              testTypeMessages={testTypeMessages}
            />
          </div>
        </div>
      </div>
    </>
  );
}
