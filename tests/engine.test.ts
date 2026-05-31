import { describe, expect, it } from 'vitest';
import { judgeResult, runSubmission } from '../src/core/engine';
import type { ProblemDefinition } from '../src/core/model';

const lesson = {
  overview: 'test',
  steps: ['test'],
  focusItems: [
    {
      name: 'test',
      kind: 'syntax' as const,
      description: 'test',
      example: 'test'
    }
  ],
  reviewCards: [
    {
      question: 'test',
      answer: 'test'
    }
  ]
};

function makeProblem(overrides: Partial<ProblemDefinition>): ProblemDefinition {
  return {
    id: 'semantics-generated',
    engine: 'excel',
    title: 'Generated',
    category: 'Semantics',
    difficulty: 1,
    prompt: 'test',
    hints: [],
    answer: 'Sub Main()\nEnd Sub',
    lesson,
    tags: [],
    entryMode: 'fullModule',
    entryPoint: 'Main',
    args: [],
    initialSheet: {},
    judge: {
      type: 'debug',
      expectedLines: []
    },
    ...overrides
  } as ProblemDefinition;
}

describe('engine semantics', () => {
  it('ByRef で呼び出し元の値を更新できる', async () => {
    const problem: ProblemDefinition = {
      id: 'semantics-byref-001',
      engine: 'excel',
      title: 'ByRef',
      category: 'Semantics',
      difficulty: 1,
      prompt: 'ByRef を確認する',
      hints: [],
      answer: [
        'Sub Increment(ByRef value As Long)',
        'value = value + 1',
        'End Sub',
        '',
        'Function Main()',
        'Dim total As Long',
        'total = 1',
        'Increment(total)',
        'Main = total',
        'End Function'
      ].join('\n'),
      lesson,
      tags: ['ByRef'],
      entryMode: 'fullModule',
      entryPoint: 'Main',
      args: [],
      initialSheet: { A1: 'dummy' },
      judge: {
        type: 'return',
        expected: 2
      }
    };

    const runResult = await runSubmission(problem, problem.answer);
    const result = judgeResult(problem, runResult);
    expect(runResult.ok).toBe(true);
    expect(result.passed).toBe(true);
  });

  it('未宣言変数をエラーにする', async () => {
    const problem: ProblemDefinition = {
      id: 'semantics-option-explicit-001',
      engine: 'excel',
      title: 'Option Explicit',
      category: 'Semantics',
      difficulty: 1,
      prompt: '未宣言変数を禁止する',
      hints: [],
      answer: [
        'Sub Main()',
        'value = 1',
        'End Sub'
      ].join('\n'),
      lesson,
      tags: ['Option Explicit'],
      entryMode: 'fullModule',
      entryPoint: 'Main',
      args: [],
      initialSheet: { A1: 'dummy' },
      judge: {
        type: 'debug',
        expectedLines: []
      }
    };

    const runResult = await runSubmission(problem, problem.answer);
    expect(runResult.ok).toBe(false);
    expect(runResult.diagnostics[0]?.message).toContain('未宣言変数');
  });

  it('文末に余ったトークンを構文エラーにする', async () => {
    const problem: ProblemDefinition = {
      id: 'semantics-trailing-token-001',
      engine: 'excel',
      title: 'Trailing token',
      category: 'Semantics',
      difficulty: 1,
      prompt: '余剰トークンを禁止する',
      hints: [],
      answer: [
        'Sub Main()',
        'Dim x As Long',
        'x = 1 2 3',
        'End Sub'
      ].join('\n'),
      lesson,
      tags: ['Syntax'],
      entryMode: 'fullModule',
      entryPoint: 'Main',
      args: [],
      initialSheet: { A1: 'dummy' },
      judge: {
        type: 'debug',
        expectedLines: []
      }
    };

    const runResult = await runSubmission(problem, problem.answer);
    expect(runResult.ok).toBe(false);
    expect(runResult.diagnostics[0]?.kind).toBe('Syntax');
    expect(runResult.diagnostics[0]?.message).toContain('文の終わり');
  });

  it('括弧なしの Sub 呼び出しで ByRef 引数を渡せる', async () => {
    const problem: ProblemDefinition = {
      id: 'semantics-bare-sub-call-001',
      engine: 'excel',
      title: 'Bare Sub call',
      category: 'Semantics',
      difficulty: 1,
      prompt: '括弧なし呼び出しを確認する',
      hints: [],
      answer: [
        'Sub AddValue(ByRef total As Long, ByVal amount As Long)',
        'total = total + amount',
        'End Sub',
        '',
        'Function Main()',
        'Dim total As Long',
        'total = 1',
        'AddValue total, 2',
        'Main = total',
        'End Function'
      ].join('\n'),
      lesson,
      tags: ['Sub'],
      entryMode: 'fullModule',
      entryPoint: 'Main',
      args: [],
      initialSheet: { A1: 'dummy' },
      judge: {
        type: 'return',
        expected: 3
      }
    };

    const runResult = await runSubmission(problem, problem.answer);
    expect(runResult.ok).toBe(true);
    expect(runResult.returnValue).toBe(3);
  });

  it('Access SQL の文字列リテラル内キーワードと真偽値文字列を壊さない', async () => {
    const problem: ProblemDefinition = {
      id: 'semantics-access-sql-string-001',
      engine: 'access',
      title: 'SQL strings',
      category: 'Semantics',
      difficulty: 1,
      prompt: 'SQL 文字列リテラルを確認する',
      hints: [],
      answer: [
        'Sub Main()',
        'CurrentDb.Execute "UPDATE Clinics SET Memo = \'TRUE回答\' WHERE Name = \'Create Clinic\'"',
        'End Sub'
      ].join('\n'),
      lesson,
      tags: ['SQL'],
      entryMode: 'fullModule',
      entryPoint: 'Main',
      args: [],
      initialDb: {
        Clinics: {
          columns: ['Name', 'Memo'],
          rows: [['Create Clinic', '']]
        }
      },
      judge: {
        type: 'table',
        table: 'Clinics',
        expectedRows: [['Create Clinic', 'TRUE回答']]
      }
    };

    const runResult = await runSubmission(problem, problem.answer);
    expect(runResult.ok).toBe(true);
    expect(runResult.snapshot.tables?.Clinics).toEqual([['Create Clinic', 'TRUE回答']]);
  });

  it('VBA と同じ優先順位で整数除算を評価する', async () => {
    const source = [
      'Function Main()',
      'Main = 10 \\ 3 * 2',
      'End Function'
    ].join('\n');
    const problem = makeProblem({
      answer: source,
      entryPoint: 'Main',
      judge: {
        type: 'return',
        expected: 1
      }
    });

    const runResult = await runSubmission(problem, source);
    const result = judgeResult(problem, runResult);
    expect(runResult.ok).toBe(true);
    expect(runResult.returnValue).toBe(1);
    expect(result.passed).toBe(true);
  });

  it('VBA と同じ優先順位で Mod を評価する', async () => {
    const source = [
      'Function Main()',
      'Main = 10 Mod 3 * 2',
      'End Function'
    ].join('\n');
    const problem = makeProblem({
      answer: source,
      entryPoint: 'Main',
      judge: {
        type: 'return',
        expected: 4
      }
    });

    const runResult = await runSubmission(problem, source);
    const result = judgeResult(problem, runResult);
    expect(runResult.ok).toBe(true);
    expect(runResult.returnValue).toBe(4);
    expect(result.passed).toBe(true);
  });

  it('Not を比較演算より低い優先順位で評価する', async () => {
    const source = [
      'Function Main()',
      'Dim a As Long',
      'Dim b As Long',
      'a = 1',
      'b = 1',
      'Main = Not a = b',
      'End Function'
    ].join('\n');
    const problem = makeProblem({
      answer: source,
      entryPoint: 'Main',
      judge: {
        type: 'return',
        expected: false
      }
    });

    const runResult = await runSubmission(problem, source);
    const result = judgeResult(problem, runResult);
    expect(runResult.ok).toBe(true);
    expect(runResult.returnValue).toBe(false);
    expect(result.passed).toBe(true);
  });

  it('Do While Not rs.EOF を評価できる', async () => {
    const source = [
      'Sub Main()',
      'Dim rs As Variant',
      'Set rs = CurrentDb.OpenRecordset("顧客")',
      'Do While Not rs.EOF',
      'Debug.Print rs.Fields("status")',
      'rs.MoveNext',
      'Loop',
      'End Sub'
    ].join('\n');
    const problem = makeProblem({
      engine: 'access',
      answer: source,
      initialDb: {
        顧客: {
          columns: ['status'],
          rows: [['未']]
        }
      },
      judge: {
        type: 'debug',
        expectedLines: ['未']
      }
    });

    const runResult = await runSubmission(problem, source);
    const result = judgeResult(problem, runResult);
    expect(runResult.ok).toBe(true);
    expect(result.passed).toBe(true);
  });

  it('Debug.Print の数値トークンを epsilon で判定する', async () => {
    const source = [
      'Sub Main()',
      'Debug.Print 0.1 + 0.2',
      'End Sub'
    ].join('\n');
    const problem = makeProblem({
      answer: source,
      judge: {
        type: 'debug',
        expectedLines: ['0.3'],
        epsilon: 1e-9
      }
    });

    const runResult = await runSubmission(problem, source);
    const result = judgeResult(problem, runResult);
    expect(runResult.ok).toBe(true);
    expect(result.passed).toBe(true);
  });

  it('Debug.Print の非数値トークンは文字列一致で判定する', async () => {
    const source = [
      'Sub Main()',
      'Debug.Print "AB"',
      'End Sub'
    ].join('\n');
    const problem = makeProblem({
      answer: source,
      judge: {
        type: 'debug',
        expectedLines: ['AC']
      }
    });

    const runResult = await runSubmission(problem, source);
    const result = judgeResult(problem, runResult);
    expect(runResult.ok).toBe(true);
    expect(result.passed).toBe(false);
  });

  it('table 判定の順序非保持比較で epsilon を使う', () => {
    const problem = makeProblem({
      judge: {
        type: 'table',
        table: 'Scores',
        expectedRows: [
          ['B', 0.3],
          ['A', 1.2]
        ],
        epsilon: 1e-9
      }
    });

    const result = judgeResult(problem, {
      ok: true,
      diagnostics: [],
      debugLines: [],
      snapshot: {
        tables: {
          Scores: [
            ['A', 1.2000000001],
            ['B', 0.1 + 0.2]
          ]
        }
      },
      durationMs: 0
    });

    expect(result.passed).toBe(true);
  });

  it('query 判定の順序保持比較で epsilon を使う', () => {
    const problem = makeProblem({
      judge: {
        type: 'query',
        sql: 'SELECT Score FROM Scores',
        expectedRows: [[0.3]],
        preserveOrder: true,
        epsilon: 1e-9
      }
    });

    const result = judgeResult(problem, {
      ok: true,
      diagnostics: [],
      debugLines: [],
      snapshot: {
        queries: {
          'SELECT Score FROM Scores': [[0.1 + 0.2]]
        }
      },
      durationMs: 0
    });

    expect(result.passed).toBe(true);
  });

  it('cell と return 判定で同じ epsilon 比較を使う', () => {
    const cellProblem = makeProblem({
      judge: {
        type: 'cell',
        expected: {
          A1: 0.3
        },
        epsilon: 1e-9
      }
    });
    const returnProblem = makeProblem({
      judge: {
        type: 'return',
        expected: 0.3,
        epsilon: 1e-9
      }
    });

    expect(judgeResult(cellProblem, {
      ok: true,
      diagnostics: [],
      debugLines: [],
      snapshot: {
        sheet: {
          A1: 0.1 + 0.2
        }
      },
      durationMs: 0
    }).passed).toBe(true);
    expect(judgeResult(returnProblem, {
      ok: true,
      diagnostics: [],
      debugLines: [],
      returnValue: 0.1 + 0.2,
      snapshot: {},
      durationMs: 0
    }).passed).toBe(true);
  });

  it.each([
    ['/', 'Main = 1 / 0'],
    ['\\', 'Main = 1 \\ 0'],
    ['Mod', 'Main = 1 Mod 0']
  ])('%s のゼロ除算を専用エラーにする', async (_operator, expression) => {
    const source = [
      'Function Main()',
      expression,
      'End Function'
    ].join('\n');
    const problem = makeProblem({
      answer: source,
      entryPoint: 'Main',
      judge: {
        type: 'return',
        expected: 0
      }
    });

    const runResult = await runSubmission(problem, source);
    expect(runResult.ok).toBe(false);
    expect(runResult.diagnostics[0]?.message).toContain('0 で割ることはできない');
  });

  it('For Step 0 を専用エラーにする', async () => {
    const source = [
      'Sub Main()',
      'Dim i As Long',
      'For i = 1 To 3 Step 0',
      'Debug.Print i',
      'Next',
      'End Sub'
    ].join('\n');
    const problem = makeProblem({
      answer: source,
      judge: {
        type: 'debug',
        expectedLines: []
      }
    });

    const runResult = await runSubmission(problem, source);
    expect(runResult.ok).toBe(false);
    expect(runResult.diagnostics[0]?.message).toContain('Step に 0');
  });
});
