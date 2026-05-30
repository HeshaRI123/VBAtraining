// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProgressRecord, RunResult } from '../src/core/model';
import App from '../src/App';

const listProgressRecordsMock = vi.fn<() => Promise<ProgressRecord[]>>();
const saveAttemptMock = vi.fn();
const runMock = vi.fn();
const disposeMock = vi.fn();
const scrollIntoViewMock = vi.fn();

let progressState: ProgressRecord[] = [];

vi.mock('@uiw/react-codemirror', () => ({
  default: ({
    value,
    onChange
  }: {
    value: string;
    onChange: (nextValue: string) => void;
  }) => (
    <textarea
      aria-label="コードエディタ"
      onChange={(event) => onChange(event.currentTarget.value)}
      value={value}
    />
  )
}));

vi.mock('../src/core/storage', () => ({
  listProgressRecords: () => listProgressRecordsMock(),
  saveAttempt: (input: {
    problemId: string;
    engine: 'excel' | 'access';
    result: 'correct' | 'incorrect' | 'error';
    durationMs: number;
  }) => saveAttemptMock(input)
}));

vi.mock('../src/worker/client', () => ({
  ExecutionWorkerClient: class {
    run(problem: unknown, source: string) {
      return runMock(problem, source);
    }

    dispose() {
      disposeMock();
    }
  }
}));

function createProgressRecord(overrides: Partial<ProgressRecord> & Pick<ProgressRecord, 'problemId' | 'engine'>): ProgressRecord {
  return {
    problemId: overrides.problemId,
    engine: overrides.engine,
    attempts: overrides.attempts ?? 1,
    correct: overrides.correct ?? 0,
    lastResult: overrides.lastResult ?? 'incorrect',
    streak: overrides.streak ?? 0,
    lastAnsweredAt: overrides.lastAnsweredAt ?? '2026-05-30T06:00:00.000Z',
    avgDurationMs: overrides.avgDurationMs ?? 120
  };
}

function createRunResponse(runResult: RunResult, judgeResult: { passed: boolean; summary: string; diagnostics: [] }) {
  return Promise.resolve({ runResult, judgeResult });
}

beforeEach(() => {
  progressState = [];
  listProgressRecordsMock.mockReset();
  listProgressRecordsMock.mockImplementation(async () => structuredClone(progressState));
  saveAttemptMock.mockReset();
  saveAttemptMock.mockImplementation(async (input) => {
    const existing = progressState.find((record) => record.problemId === input.problemId);
    const nextRecord: ProgressRecord = existing
      ? {
          ...existing,
          attempts: existing.attempts + 1,
          correct: existing.correct + (input.result === 'correct' ? 1 : 0),
          streak: input.result === 'correct' ? existing.streak + 1 : 0,
          lastResult: input.result,
          lastAnsweredAt: '2026-05-30T06:05:00.000Z',
          avgDurationMs: input.durationMs
        }
      : {
          problemId: input.problemId,
          engine: input.engine,
          attempts: 1,
          correct: input.result === 'correct' ? 1 : 0,
          lastResult: input.result,
          streak: input.result === 'correct' ? 1 : 0,
          lastAnsweredAt: '2026-05-30T06:05:00.000Z',
          avgDurationMs: input.durationMs
        };

    progressState = [...progressState.filter((record) => record.problemId !== input.problemId), nextRecord];
    return nextRecord;
  });
  runMock.mockReset();
  disposeMock.mockReset();
  scrollIntoViewMock.mockReset();

  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());

  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoViewMock
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('App UI', () => {
  it('問題初期表示時に導入パネルが開いている', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'この問題の進め方' })).toBeTruthy();
    expect(screen.getByText(/同じ計算を複数行に繰り返し適用/)).toBeTruthy();
    expect(screen.getByText('使うもの')).toBeTruthy();
    expect(screen.getByText('進め方')).toBeTruthy();
  });

  it('書いてみるで導入パネルが閉じ、問題切り替えで再表示される', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole('heading', { name: 'この問題の進め方' });
    await user.click(screen.getByRole('button', { name: '書いてみる' }));
    expect(screen.queryByRole('heading', { name: 'この問題の進め方' })).toBeNull();

    await user.click(screen.getByRole('button', { name: /名前を整形して表示する/ }));
    expect(await screen.findByRole('heading', { name: 'この問題の進め方' })).toBeTruthy();
  });

  it('ヒントと模範解答を個別表示できる', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /名前を整形して表示する/ }));
    await screen.findByText(/文字列を取り出して加工/);

    await user.click(screen.getByRole('button', { name: 'ヒント' }));
    expect(screen.getByText('UCase と Len を使うんな')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '模範解答' }));
    expect(screen.getByText(/Debug\.Print UCase\(nameText\) & "-" & Len\(nameText\)/)).toBeTruthy();
  });

  it('採点成功時に結果カードへ自動移動し、保存と再読込が走る', async () => {
    const user = userEvent.setup();
    runMock.mockImplementation(() =>
      createRunResponse(
        {
          ok: true,
          diagnostics: [],
          debugLines: [],
          returnValue: undefined,
          snapshot: { sheet: { D2: 200, D3: 200, D4: 300 } },
          durationMs: 25
        },
        {
          passed: true,
          summary: 'セル状態が一致したんな',
          diagnostics: []
        }
      )
    );

    render(<App />);

    await user.click(screen.getByRole('button', { name: '実行して採点' }));

    await waitFor(() => {
      expect(saveAttemptMock).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 'correct',
          durationMs: 25
        })
      );
    });

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: '採点結果' }));
    expect(screen.getByText('セル状態が一致したんな')).toBeTruthy();
    expect(screen.getByText(/採点完了。合格なんな。セル状態が一致したんな/)).toBeTruthy();
    expect(listProgressRecordsMock).toHaveBeenCalledTimes(2);
  });

  it('不正解時でも結果へ移動し、再挑戦の要約を表示する', async () => {
    const user = userEvent.setup();
    runMock.mockImplementation(() =>
      createRunResponse(
        {
          ok: true,
          diagnostics: [],
          debugLines: [],
          returnValue: undefined,
          snapshot: { sheet: { D2: 100 } },
          durationMs: 18
        },
        {
          passed: false,
          summary: 'D2 の値が期待と違うんな',
          diagnostics: []
        }
      )
    );

    render(<App />);

    await user.click(screen.getByRole('button', { name: '実行して採点' }));

    await screen.findByText('D2 の値が期待と違うんな');
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/採点完了。合格ではなかったんな。D2 の値が期待と違うんな/)).toBeTruthy();
  });

  it('実行エラー時でも結果へ移動し診断を見せる', async () => {
    const user = userEvent.setup();
    runMock.mockImplementation(() =>
      createRunResponse(
        {
          ok: false,
          diagnostics: [
            {
              kind: 'Runtime',
              severity: 'error',
              message: '未宣言変数 value が使われているんな'
            }
          ],
          debugLines: [],
          returnValue: undefined,
          snapshot: {},
          durationMs: 12
        },
        {
          passed: false,
          summary: '実行エラーで採点できなかったんな',
          diagnostics: []
        }
      )
    );

    render(<App />);

    await user.click(screen.getByRole('button', { name: '実行して採点' }));

    await screen.findByText('実行エラーで採点できなかったんな');
    expect(saveAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'error',
        durationMs: 12
      })
    );
    expect(screen.getByText('未宣言変数 value が使われているんな')).toBeTruthy();
  });

  it('復習モードでは挑戦済み問題だけを優先順で表示し、答え表示から問題へ戻れる', async () => {
    const user = userEvent.setup();
    progressState = [
      createProgressRecord({ problemId: 'xls-loop-001', engine: 'excel', attempts: 3, correct: 1, lastResult: 'correct' }),
      createProgressRecord({ problemId: 'xls-debug-001', engine: 'excel', attempts: 1, correct: 0, lastResult: 'incorrect' }),
      createProgressRecord({ problemId: 'xls-return-001', engine: 'excel', attempts: 1, correct: 0, lastResult: 'error' }),
      createProgressRecord({ problemId: 'acc-rs-001', engine: 'access', attempts: 1, correct: 0, lastResult: 'incorrect' })
    ];

    render(<App />);

    await user.click(screen.getByRole('button', { name: '復習' }));

    const reviewHeadings = await screen.findAllByRole('heading', { level: 3 });
    expect(reviewHeadings.map((heading) => heading.textContent)).toEqual([
      '配列の合計を返す',
      '名前を整形して表示する',
      '客単価をD列に入れる'
    ]);

    const firstReview = reviewHeadings[0]?.closest('article');
    if (!firstReview) {
      throw new Error('復習カードが見つからないんな');
    }

    await user.click(within(firstReview).getAllByRole('button', { name: '答えを見る' })[0]);
    expect(within(firstReview).getByText(/関数名そのもの/)).toBeTruthy();

    await user.click(within(firstReview).getAllByRole('button', { name: 'この問題に戻る' })[0]);
    expect(await screen.findByRole('heading', { name: '配列の合計を返す' })).toBeTruthy();
  });
});
