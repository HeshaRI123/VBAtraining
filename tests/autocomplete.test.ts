import { describe, expect, it } from 'vitest';
import { getMemberCompletions, getTopLevelCompletions } from '../src/editor/autocomplete';
import type { ProblemDefinition } from '../src/core/model';
import { problems } from '../src/data/problems';

function getProblem(problemId: string): ProblemDefinition {
  const problem = problems.find((item) => item.id === problemId);
  if (!problem) {
    throw new Error(`problem ${problemId} が見つからないんな`);
  }
  return problem;
}

function labels(problemId: string): string[] {
  return getTopLevelCompletions(getProblem(problemId)).map((item) => item.label);
}

describe('autocomplete helpers', () => {
  it('Excel モードで VBA 基本キーワード候補が出る', () => {
    expect(labels('xls-loop-001')).toEqual(expect.arrayContaining(['Dim', 'If', 'For', 'Select Case']));
  });

  it('Excel 問題では focusItems の関数候補が出る', () => {
    expect(labels('xls-debug-001')).toEqual(expect.arrayContaining(['UCase', 'Len']));
  });

  it('Access モードでドメイン関数候補が出る', () => {
    expect(labels('acc-debug-001')).toEqual(expect.arrayContaining(['DLookup', 'DCount', 'DSum']));
  });

  it('Excel グローバル候補として Cells と Range が出る', () => {
    expect(labels('xls-loop-001')).toEqual(expect.arrayContaining(['Cells', 'Range']));
  });

  it('CurrentDb の後に Access メンバー候補が出る', () => {
    expect(getMemberCompletions('access', 'CurrentDb.').map((item) => item.label)).toEqual(
      expect.arrayContaining(['OpenRecordset', 'Execute'])
    );
  });

  it('rs の後に Recordset 候補が出る', () => {
    expect(getMemberCompletions('access', 'rs.').map((item) => item.label)).toEqual(
      expect.arrayContaining(['EOF', 'Fields', 'MoveNext', 'Edit', 'Update', 'Delete', 'AddNew'])
    );
  });

  it('スニペット候補は最小 4 種だけを持つ', () => {
    const snippetLabels = getTopLevelCompletions(getProblem('xls-return-001'))
      .filter((item) => item.detail === 'snippet')
      .map((item) => item.label)
      .sort();

    expect(snippetLabels).toEqual([
      'Do While ... Loop',
      'For ... Next',
      'If ... End If',
      'Select Case ... End Select'
    ]);
  });
});
