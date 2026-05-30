import { describe, expect, it } from 'vitest';
import { validateProblem } from '../src/core/engine';
import type { ProblemDefinition } from '../src/core/model';
import { problems } from '../src/data/problems';
import { getThemeExample, themeExamples } from '../src/data/theme-examples';

function cloneProblem(problemId: string): ProblemDefinition {
  const problem = problems.find((item) => item.id === problemId);
  if (!problem) {
    throw new Error(`problem ${problemId} が見つからないんな`);
  }
  return structuredClone(problem);
}

describe('problem lesson validation', () => {
  it('lesson 欠落問題を拒否する', () => {
    const problem = cloneProblem('xls-loop-001') as ProblemDefinition & { lesson?: ProblemDefinition['lesson'] };
    delete problem.lesson;

    const result = validateProblem(problem as ProblemDefinition);

    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.message.includes('lesson は必須'))).toBe(true);
  });

  it('focusItems の構造が壊れている問題を拒否する', () => {
    const problem = cloneProblem('xls-debug-001');
    problem.lesson.focusItems = [
      {
        name: 'Broken',
        kind: 'function',
        description: '',
        example: ''
      }
    ];

    const result = validateProblem(problem);

    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.message.includes('lesson.focusItems'))).toBe(true);
  });

  it('収録済み問題は拡張後も全件 validation を通る', () => {
    const diagnostics = problems.flatMap((problem) => validateProblem(problem).diagnostics);

    expect(diagnostics).toEqual([]);
  });

  it('テーマ例題は全件 validation を通る', () => {
    const diagnostics = themeExamples.flatMap((example) => validateProblem(example).diagnostics);

    expect(diagnostics).toEqual([]);
  });

  it('収録済み問題の engine と category に対応するテーマ例題がある', () => {
    const missingThemes = problems
      .filter((problem) => !getThemeExample(problem.engine, problem.category))
      .map((problem) => `${problem.engine}:${problem.category}`);

    expect(missingThemes).toEqual([]);
  });
});
