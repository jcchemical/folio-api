import { WorkItemStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { ALLOWED_TRANSITIONS, canTransition } from './work-item-transitions.js';

describe('WorkItem transition graph', () => {
  const valid = new Set([
    'IDENTIFIED:VALIDATED',
    'IDENTIFIED:NEEDS_REVIEW',
    'NEEDS_REVIEW:VALIDATED',
  ]);

  for (const from of Object.values(WorkItemStatus)) {
    for (const to of Object.values(WorkItemStatus)) {
      it(`${from} -> ${to}`, () => {
        expect(canTransition(from, to)).toBe(valid.has(`${from}:${to}`));
      });
    }
  }

  it('declares every enum state and keeps VALIDATED terminal', () => {
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual(
      Object.values(WorkItemStatus).sort(),
    );
    expect(ALLOWED_TRANSITIONS.VALIDATED).toEqual([]);
  });
});
