import { describe, expect, it } from 'vitest';
import { checkProblemSet } from '../src/core/engine';
import { problems } from '../src/data/problems';

describe('problem set', () => {
  it('模範解答が全件 judge を通る', async () => {
    const summary = await checkProblemSet(problems);
    expect(summary.valid).toBe(true);
  });
});
