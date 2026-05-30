import { describe, expect, it } from 'vitest';
import { checkProblemSet } from '../src/core/engine';
import { problems } from '../src/data/problems';
import { themeExamples } from '../src/data/theme-examples';

describe('problem set', () => {
  it('模範解答が全件 judge を通る', async () => {
    const summary = await checkProblemSet(problems);
    expect(summary.valid).toBe(true);
  });

  it('テーマ例題の模範解答が全件 judge を通る', async () => {
    const summary = await checkProblemSet(themeExamples);
    expect(summary.valid).toBe(true);
  });
});
