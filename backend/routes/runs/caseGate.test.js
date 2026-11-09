import { describe, it, expect } from 'vitest';
import { gateFor, roleIndex } from './caseGate.js';

const DEV = roleIndex('developer');
const REPORTER = roleIndex('reporter');
const UNTESTED = 0;
const PASSED = 1;
const SKIPPED = 4;

const entry = (id, ownerRole, status) => ({ id, title: `case ${id}`, ownerRole, status });

describe('gateFor', () => {
  it('lets a reporter work when nothing is owned by anyone else', () => {
    const order = [entry(1, null, UNTESTED), entry(2, REPORTER, UNTESTED)];

    expect(gateFor(order, REPORTER)).toEqual({ blocking: [], blockedCaseIds: [] });
  });

  it('holds back everything that comes after an untested case of another role', () => {
    const order = [entry(1, DEV, UNTESTED), entry(2, REPORTER, UNTESTED), entry(3, null, UNTESTED)];

    const gate = gateFor(order, REPORTER);

    expect(gate.blockedCaseIds).toEqual([2, 3]);
    expect(gate.blocking.map((c) => c.id)).toEqual([1]);
  });

  it('leaves alone what comes before it', () => {
    const order = [entry(1, REPORTER, UNTESTED), entry(2, DEV, UNTESTED), entry(3, REPORTER, UNTESTED)];

    expect(gateFor(order, REPORTER).blockedCaseIds).toEqual([3]);
  });

  it('opens up as soon as the other role has answered, whatever the answer', () => {
    const order = [entry(1, DEV, SKIPPED), entry(2, REPORTER, UNTESTED)];

    expect(gateFor(order, REPORTER)).toEqual({ blocking: [], blockedCaseIds: [] });
  });

  it('never lets cases of one owner block each other', () => {
    const order = [entry(1, REPORTER, UNTESTED), entry(2, REPORTER, UNTESTED), entry(3, REPORTER, UNTESTED)];

    expect(gateFor(order, REPORTER).blockedCaseIds).toEqual([]);
  });

  it('does not report a trailing case of another role as blocking', () => {
    const order = [entry(1, REPORTER, PASSED), entry(2, DEV, UNTESTED)];

    expect(gateFor(order, REPORTER)).toEqual({ blocking: [], blockedCaseIds: [] });
  });

  it('names every untested case of another role that still has ours behind it', () => {
    const order = [
      entry(1, DEV, UNTESTED),
      entry(2, DEV, PASSED),
      entry(3, DEV, UNTESTED),
      entry(4, REPORTER, UNTESTED),
      entry(5, DEV, UNTESTED),
    ];

    const gate = gateFor(order, REPORTER);

    expect(gate.blocking.map((c) => c.id)).toEqual([1, 3]);
    expect(gate.blockedCaseIds).toEqual([4]);
  });

  it('reads the same run differently for each role', () => {
    const order = [entry(1, REPORTER, UNTESTED), entry(2, DEV, UNTESTED)];

    expect(gateFor(order, REPORTER).blockedCaseIds).toEqual([]);
    expect(gateFor(order, DEV).blockedCaseIds).toEqual([2]);
  });

  it('treats an unowned case as everyone’s', () => {
    const order = [entry(1, null, UNTESTED), entry(2, DEV, UNTESTED), entry(3, null, UNTESTED)];

    const gate = gateFor(order, REPORTER);

    expect(gate.blockedCaseIds).toEqual([3]);
    expect(gate.blocking.map((c) => c.id)).toEqual([2]);
  });
});
