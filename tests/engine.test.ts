import { describe, expect, it } from 'vitest';
import { judgeResult, runSubmission } from '../src/core/engine';
import type { ProblemDefinition } from '../src/core/model';

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
});
