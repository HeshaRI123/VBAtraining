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
});
