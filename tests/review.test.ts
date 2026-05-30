import { describe, expect, it } from 'vitest';
import type { ProgressRecord } from '../src/core/model';
import { problems } from '../src/data/problems';
import { getReviewProblems } from '../src/review';

const baseTime = '2026-05-30T06:00:00.000Z';

function createRecord(overrides: Partial<ProgressRecord> & Pick<ProgressRecord, 'problemId' | 'engine'>): ProgressRecord {
  return {
    problemId: overrides.problemId,
    engine: overrides.engine,
    attempts: overrides.attempts ?? 1,
    correct: overrides.correct ?? 0,
    lastResult: overrides.lastResult ?? 'incorrect',
    streak: overrides.streak ?? 0,
    lastAnsweredAt: overrides.lastAnsweredAt ?? baseTime,
    avgDurationMs: overrides.avgDurationMs ?? 120
  };
}

describe('review helpers', () => {
  it('未挑戦問題は復習一覧に出さない', () => {
    const reviewProblems = getReviewProblems(
      problems,
      [createRecord({ problemId: 'xls-loop-001', engine: 'excel', lastResult: 'correct', correct: 1 })],
      'excel'
    );

    expect(reviewProblems.map((item) => item.problem.id)).toEqual(['xls-loop-001']);
  });

  it('error と incorrect を優先して並べる', () => {
    const reviewProblems = getReviewProblems(
      problems,
      [
        createRecord({ problemId: 'xls-loop-001', engine: 'excel', lastResult: 'correct', correct: 2, attempts: 2 }),
        createRecord({ problemId: 'xls-debug-001', engine: 'excel', lastResult: 'incorrect', correct: 0 }),
        createRecord({ problemId: 'xls-return-001', engine: 'excel', lastResult: 'error', correct: 0 })
      ],
      'excel'
    );

    expect(reviewProblems.map((item) => item.problem.id)).toEqual([
      'xls-return-001',
      'xls-debug-001',
      'xls-loop-001'
    ]);
  });

  it('同じ結果なら正答率の低い問題を先に並べる', () => {
    const reviewProblems = getReviewProblems(
      problems,
      [
        createRecord({ problemId: 'acc-rs-001', engine: 'access', lastResult: 'correct', correct: 1, attempts: 4 }),
        createRecord({ problemId: 'acc-debug-001', engine: 'access', lastResult: 'correct', correct: 3, attempts: 4 })
      ],
      'access'
    );

    expect(reviewProblems.map((item) => item.problem.id)).toEqual(['acc-rs-001', 'acc-debug-001']);
  });

  it('エンジン切り替え時は対象エンジンだけを返す', () => {
    const reviewProblems = getReviewProblems(
      problems,
      [
        createRecord({ problemId: 'xls-loop-001', engine: 'excel', lastResult: 'incorrect' }),
        createRecord({ problemId: 'acc-rs-001', engine: 'access', lastResult: 'incorrect' })
      ],
      'access'
    );

    expect(reviewProblems.map((item) => item.problem.id)).toEqual(['acc-rs-001']);
  });
});
