'use client';
import { useContext, useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tab, Tabs, Tooltip } from '@heroui/react';
import { CircleHelp } from 'lucide-react';
import { fetchTrackingReport } from './trackingControl';
import { memberRoles } from '@/config/selection';
import { TokenContext } from '@/utils/TokenProvider';
import { logError } from '@/utils/errorHandler';
import type { TrackingMemberType, TrackingMessages, TrackingReportType, TrackingRoleType } from '@/types/tracking';

type Props = {
  projectId: string;
  messages: TrackingMessages;
};

const EMPTY: TrackingReportType = {
  overall: { cases: 0, played: 0, settled: 0, disagreeing: 0, awaiting: 0, statusCounts: [] },
  byRun: [],
  byMember: [],
  byRole: [],
};

/** Un intitulé avec son explication : ces colonnes ne se devinent pas. */
function HeaderWithHint({ label, hint }: { label: string; hint: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Tooltip content={hint}>
        <CircleHelp size={13} className="text-default-400" />
      </Tooltip>
    </span>
  );
}

export default function TrackingPage({ projectId, messages }: Props) {
  const context = useContext(TokenContext);
  const [report, setReport] = useState<TrackingReportType>(EMPTY);
  const isSignedIn = context.isSignedIn();

  useEffect(() => {
    async function fetchDataEffect() {
      if (!context.isSignedIn()) {
        return;
      }
      try {
        setReport(await fetchTrackingReport(context.token.access_token, projectId));
      } catch (error: unknown) {
        logError('Error fetching tracking report:', error);
      }
    }

    fetchDataEffect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, projectId]);

  const roleLabel = (role: number) => {
    const uid = memberRoles[role] ? memberRoles[role].uid : '';
    if (uid === 'manager') return messages.manager;
    if (uid === 'developer') return messages.developer;
    if (uid === 'reporter') return messages.reporter;
    return String(role);
  };

  /**
   * L'accord ne se lit que sur les cas qu'au moins deux personnes ont jugés.
   * Afficher 100 % sur zéro comparaison mentirait — et c'est l'état normal
   * tant qu'une seule personne joue.
   */
  const agreement = (comparable: number, agreeing: number) =>
    comparable === 0 ? (
      <Tooltip content={messages.notComparableHint}>
        <span className="text-default-400">{messages.notComparable}</span>
      </Tooltip>
    ) : (
      <span>
        {Math.round((agreeing / comparable) * 100)} % <span className="text-tiny text-default-500">({comparable})</span>
      </span>
    );

  const coverage = (touched: number, eligible: number) =>
    eligible === 0 ? <span className="text-default-400">—</span> : <span>{`${touched} / ${eligible}`}</span>;

  const peopleRows = (rows: (TrackingMemberType | TrackingRoleType)[], firstColumn: string) => (
    <Table isCompact removeWrapper aria-label={firstColumn}>
      <TableHeader>
        <TableColumn key="who">{firstColumn}</TableColumn>
        <TableColumn key="coverage">
          <HeaderWithHint label={messages.coverage} hint={messages.coverageHint} />
        </TableColumn>
        <TableColumn key="agreement">{messages.agreement}</TableColumn>
        <TableColumn key="remaining">{messages.remaining}</TableColumn>
      </TableHeader>
      <TableBody emptyContent={messages.noData}>
        {rows.map((row) => {
          const isMember = 'userId' in row;
          return (
            <TableRow key={isMember ? `m${row.userId}` : `r${row.role}`}>
              <TableCell>
                {isMember ? (
                  <div className="min-w-0">
                    <p className="truncate">{row.username}</p>
                    <p className="text-tiny text-default-500">{roleLabel(row.role)}</p>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <p className="truncate">{roleLabel(row.role)}</p>
                    <p className="text-tiny text-default-500">
                      {row.members} {messages.membersCount}
                    </p>
                  </div>
                )}
              </TableCell>
              <TableCell>{coverage(row.runsTouched, row.runsEligible)}</TableCell>
              <TableCell>{agreement(row.comparable, row.agreeing)}</TableCell>
              <TableCell>{row.awaiting}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  const { overall } = report;

  return (
    <div className="container mx-auto max-w-5xl pt-6 px-6">
      <h3 className="font-bold">{messages.title}</h3>
      <p className="mt-1 text-small text-default-600">{messages.subtitle}</p>

      <Tabs aria-label={messages.title} className="mt-4">
        <Tab key="overall" title={messages.overall}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: messages.cases, value: overall.cases, hint: null },
              { label: messages.played, value: overall.played, hint: null },
              { label: messages.settled, value: overall.settled, hint: messages.settledHint },
              { label: messages.disagreeing, value: overall.disagreeing, hint: messages.disagreeingHint },
              { label: messages.awaiting, value: overall.awaiting, hint: null },
            ].map((stat) => (
              <div key={stat.label} className="rounded-medium border-medium border-default-200 p-3">
                <p className="text-small text-default-600">
                  {stat.hint ? <HeaderWithHint label={stat.label} hint={stat.hint} /> : stat.label}
                </p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            ))}
          </div>

          <Table isCompact removeWrapper aria-label={messages.campaign} className="mt-6">
            <TableHeader>
              <TableColumn key="name">{messages.campaign}</TableColumn>
              <TableColumn key="cases">{messages.cases}</TableColumn>
              <TableColumn key="played">{messages.played}</TableColumn>
              <TableColumn key="settled">{messages.settled}</TableColumn>
              <TableColumn key="disagreeing">{messages.disagreeing}</TableColumn>
              <TableColumn key="awaiting">{messages.awaiting}</TableColumn>
            </TableHeader>
            <TableBody emptyContent={messages.noData}>
              {report.byRun.map((run) => (
                <TableRow key={run.runId}>
                  <TableCell>{run.name}</TableCell>
                  <TableCell>{run.cases}</TableCell>
                  <TableCell>{run.played}</TableCell>
                  <TableCell>{run.settled}</TableCell>
                  <TableCell>{run.disagreeing}</TableCell>
                  <TableCell>{run.awaiting}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Tab>

        <Tab key="byMember" title={messages.byMember}>
          {peopleRows(report.byMember, messages.member)}
        </Tab>

        <Tab key="byRole" title={messages.byRole}>
          {peopleRows(report.byRole, messages.role)}
        </Tab>
      </Tabs>
    </div>
  );
}
