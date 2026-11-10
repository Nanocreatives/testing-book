import { useState, useEffect, useMemo, ReactNode } from 'react';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
  Button,
  DropdownTrigger,
  Dropdown,
  DropdownMenu,
  DropdownItem,
  Selection,
  SortDescriptor,
  Chip,
} from '@heroui/react';
import { MoreVertical, CopyPlus, CopyMinus, MessageCircle, Lock } from 'lucide-react';
import RunCaseStatus from './RunCaseStatus';
import AssigneePicker from './AssigneePicker';
import { Link, NextUiLinkClasses } from '@/src/i18n/routing';
import { testRunCaseStatus, memberRoles } from '@/config/selection';
import { CaseType } from '@/types/case';
import { RunMessages } from '@/types/run';
import { PriorityMessages } from '@/types/priority';
import TestCasePriority from '@/components/TestCasePriority';
import { TestTypeMessages } from '@/types/testType';
import { TestRunCaseStatusMessages } from '@/types/status';
import { MemberType } from '@/types/user';

type Props = {
  projectId: string;
  runId: string;
  locale: string;
  cases: CaseType[];
  isDisabled: boolean;
  blockedCaseIds: number[];
  isManager: boolean;
  members: MemberType[];
  selectedKeys: Selection;
  onSelectionChange: React.Dispatch<React.SetStateAction<Selection>>;
  onChangeStatus: (changeCaseId: number, status: number) => void;
  onIncludeCase: (includeCaseId: number) => void;
  onExcludeCase: (excludeCaseId: number) => void;
  onAssignCase: (runCaseId: number, userId: number | null) => void;
  messages: RunMessages;
  testRunCaseStatusMessages: TestRunCaseStatusMessages;
  priorityMessages: PriorityMessages;
  testTypeMessages: TestTypeMessages;
};

/** Assez pour balayer une section, assez peu pour que le volet de détail reste en vue. */
const ROWS_PER_PAGE = 25;

export default function TestCaseSelector({
  projectId,
  runId,
  locale,
  cases,
  isDisabled,
  blockedCaseIds,
  isManager,
  members,
  selectedKeys,
  onSelectionChange,
  onChangeStatus,
  onIncludeCase,
  onExcludeCase,
  onAssignCase,
  messages,
  testRunCaseStatusMessages,
  priorityMessages,
}: Props) {
  const headerColumns = [
    { name: messages.id, uid: 'id', sortable: true },
    { name: messages.title, uid: 'title', sortable: true },
    { name: messages.priority, uid: 'priority', sortable: true },
    { name: messages.tags, uid: 'tags', sortable: false },
    { name: messages.status, uid: 'runStatus', sortable: true },
    { name: messages.assignee, uid: 'assignee', sortable: true },
    { name: messages.comments, uid: 'comments', sortable: false },
    { name: messages.actions, uid: 'actions' },
  ];

  const [disabledStatusKeys, setDisabledStatusKeys] = useState<string[]>([]);
  const [disabledIncludeExcludeKeys, setDisabledIncludeExcludeKeys] = useState<string[]>([]);
  useEffect(() => {
    if (isDisabled) {
      setDisabledStatusKeys(
        testRunCaseStatus.map((entry) => {
          return entry.uid;
        })
      );
      setDisabledIncludeExcludeKeys(['include', 'exclude']);
    } else {
      setDisabledStatusKeys([]);
      setDisabledIncludeExcludeKeys([]);
    }
  }, [isDisabled]);

  const [page, setPage] = useState(1);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'id',
    direction: 'ascending',
  });

  const sortedItems = useMemo(() => {
    return [...cases].sort((a: CaseType, b: CaseType) => {
      let first: number | string, second: number | string;

      switch (sortDescriptor.column) {
        case 'runStatus':
          first = a.RunCases && a.RunCases.length > 0 ? a.RunCases[0].status : -1;
          second = b.RunCases && b.RunCases.length > 0 ? b.RunCases[0].status : -1;
          break;
        case 'title':
          first = a.title;
          second = b.title;
          break;
        case 'priority':
          first = a.priority;
          second = b.priority;
          break;
        case 'assignee':
          first = a.RunCases && a.RunCases.length > 0 ? a.RunCases[0].assigneeUserId || -1 : -1;
          second = b.RunCases && b.RunCases.length > 0 ? b.RunCases[0].assigneeUserId || -1 : -1;
          break;
        case 'id':
        default:
          first = a.id;
          second = b.id;
          break;
      }

      const cmp = first < second ? -1 : first > second ? 1 : 0;

      return sortDescriptor.direction === 'descending' ? -cmp : cmp;
    });
  }, [sortDescriptor, cases]);

  const ownerRoleLabel = (ownerRole: number) => {
    const uid = memberRoles[ownerRole] ? memberRoles[ownerRole].uid : '';
    if (uid === 'manager') return messages.roleManager;
    if (uid === 'developer') return messages.roleDeveloper;
    if (uid === 'reporter') return messages.roleReporter;
    return messages.ownerEveryone;
  };

  const notIncludedCaseClass = 'text-neutral-200 dark:text-neutral-600';

  const isCaseIncluded = (testCase: CaseType) => {
    let isIncluded = false;
    if (testCase.RunCases && testCase.RunCases.length > 0) {
      if (testCase.RunCases[0].editState !== 'deleted') {
        // Even if RunCase[0] exists, if 'deleted' it will be as not included.
        isIncluded = true;
      }
    }

    return isIncluded;
  };
  const renderCell = (testCase: CaseType, columnKey: string): ReactNode => {
    const cellValue = testCase[columnKey as keyof CaseType];
    const isIncluded = isCaseIncluded(testCase);
    // Held back by work that belongs to someone else, and placed before this one.
    const isBlocked = blockedCaseIds.includes(testCase.id);
    const runStatus = testCase.RunCases && testCase.RunCases.length > 0 ? testCase.RunCases[0].status : 0;
    const commentCount = testCase.RunCases && testCase.RunCases.length > 0 ? testCase.RunCases[0].commentCount || 0 : 0;

    switch (columnKey) {
      case 'title':
        return (
          <div className={isIncluded ? '' : notIncludedCaseClass}>
            <Link
              href={`/projects/${projectId}/runs/${runId}/cases/${testCase.id}`}
              locale={locale}
              className={`${NextUiLinkClasses} block max-w-24 truncate`}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {cellValue as string}
            </Link>
            <div className="mt-1 flex items-center gap-1">
              {testCase.ownerRole !== null && testCase.ownerRole !== undefined && (
                <Chip size="sm" variant="flat">
                  {ownerRoleLabel(testCase.ownerRole)}
                </Chip>
              )}
              {isBlocked && <Lock size={12} className="text-warning" aria-label={messages.caseBlocked} />}
            </div>
          </div>
        );
      case 'priority':
        return (
          <div className={isIncluded ? '' : notIncludedCaseClass}>
            <TestCasePriority priorityValue={cellValue as number} priorityMessages={priorityMessages} />
          </div>
        );
      case 'tags':
        return (
          <div className={`flex gap-1 flex-wrap ${isIncluded ? '' : notIncludedCaseClass}`}>
            {testCase.Tags && testCase.Tags.length > 0 ? (
              testCase.Tags.map((tag) => (
                <Chip key={tag.id} size="sm" variant="flat">
                  {tag.name}
                </Chip>
              ))
            ) : (
              <span>-</span>
            )}
          </div>
        );
      case 'runStatus':
        return (
          <Dropdown>
            <DropdownTrigger>
              <Button
                isIconOnly
                radius="full"
                size="sm"
                variant="light"
                title={
                  isBlocked
                    ? messages.caseBlocked
                    : isIncluded
                      ? testRunCaseStatusMessages[testRunCaseStatus[runStatus].uid]
                      : undefined
                }
                isDisabled={!isIncluded || isBlocked}
              >
                {isIncluded ? <RunCaseStatus uid={testRunCaseStatus[runStatus].uid} /> : '-'}
              </Button>
            </DropdownTrigger>
            <DropdownMenu disabledKeys={disabledStatusKeys} aria-label="test case actions">
              {testRunCaseStatus.map((runCaseStatus, index) => (
                <DropdownItem
                  key={runCaseStatus.uid}
                  startContent={<RunCaseStatus uid={runCaseStatus.uid} />}
                  onPress={() => onChangeStatus(testCase.id, index)}
                >
                  {testRunCaseStatusMessages[runCaseStatus.uid]}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        );
      case 'assignee': {
        const runCaseId = testCase.RunCases && testCase.RunCases.length > 0 ? testCase.RunCases[0].id : null;
        const currentAssignee =
          testCase.RunCases && testCase.RunCases.length > 0 ? testCase.RunCases[0].assigneeUserId : null;
        if (!isIncluded || !runCaseId || runCaseId < 0) {
          return <span className={notIncludedCaseClass}>-</span>;
        }
        return (
          <AssigneePicker
            isAvatarOnly={true}
            assigneeUserId={currentAssignee ?? null}
            members={members}
            isDisabled={!isManager}
            unassignedLabel={messages.unassigned}
            searchPlaceholder={messages.searchAssignee}
            onAssign={(userId) => onAssignCase(runCaseId, userId)}
          />
        );
      }
      case 'comments':
        return (
          <div className={isIncluded ? '' : notIncludedCaseClass}>
            {isIncluded && commentCount > 0 ? (
              <Link
                href={`/projects/${projectId}/runs/${runId}/cases/${testCase.id}?tab=comments`}
                locale={locale}
                className="flex items-center gap-1"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <MessageCircle size={16} />
                <span>{commentCount}</span>
              </Link>
            ) : (
              <span className="text-default-400">-</span>
            )}
          </div>
        );
      case 'actions':
        return (
          <Dropdown>
            <DropdownTrigger>
              <Button isIconOnly radius="full" size="sm" variant="light">
                <MoreVertical size={16} />
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              disabledKeys={isBlocked ? ['include', 'exclude'] : disabledIncludeExcludeKeys}
              aria-label="include or exclude actions"
            >
              <DropdownItem
                key="include"
                startContent={<CopyPlus size={16} />}
                onPress={() => {
                  if (isIncluded) {
                    return;
                  }
                  onIncludeCase(testCase.id);
                }}
              >
                {messages.includeInRun}
              </DropdownItem>
              <DropdownItem
                key="exclude"
                startContent={<CopyMinus size={16} />}
                onPress={() => {
                  if (!isIncluded) {
                    return;
                  }
                  onExcludeCase(testCase.id);
                }}
              >
                {messages.excludeFromRun}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        );
      default:
        return cellValue as string;
    }
  };

  const classNames = useMemo(
    () => ({
      wrapper: ['min-w-3xl'],
      th: ['bg-transparent', 'text-default-500', 'border-b', 'border-divider'],
      td: [
        // changing the rows border radius
        // first
        'group-data-[first=true]:first:before:rounded-none',
        'group-data-[first=true]:last:before:rounded-none',
        // middle
        'group-data-[middle=true]:before:rounded-none',
        // last
        'group-data-[last=true]:first:before:rounded-none',
        'group-data-[last=true]:last:before:rounded-none',
      ],
    }),
    []
  );

  const handleSelectionChange = (keys: Selection) => {
    onSelectionChange(keys);
  };

  // Une campagne de cent soixante-dix cas tient mal sur une page : on cherche
  // un cas, on ne parcourt pas la liste.
  const pageCount = Math.max(1, Math.ceil(sortedItems.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = sortedItems.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  return (
    <>
      <Table
        isCompact
        removeWrapper
        aria-label="Tese cases table"
        classNames={classNames}
        selectedKeys={selectedKeys}
        selectionMode="multiple"
        sortDescriptor={sortDescriptor}
        onSelectionChange={handleSelectionChange}
        onSortChange={setSortDescriptor}
      >
        <TableHeader columns={headerColumns}>
          {(column) => (
            <TableColumn
              key={column.uid}
              align={column.uid === 'actions' ? 'center' : 'start'}
              allowsSorting={column.sortable}
            >
              {column.name}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody emptyContent={messages.noCasesFound}>
          {pageItems.map((item) => (
            <TableRow key={item.id} className={isCaseIncluded(item) ? '' : notIncludedCaseClass}>
              {headerColumns.map((column) => (
                <TableCell key={column.uid}>{renderCell(item, column.uid)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pageCount > 1 && (
        <div className="flex justify-center py-3">
          <Pagination
            isCompact
            showControls
            size="sm"
            page={currentPage}
            total={pageCount}
            onChange={setPage}
            aria-label={messages.selectTestCase}
          />
        </div>
      )}
    </>
  );
}
