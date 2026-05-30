import type { EngineType, ProblemDefinition, ProgressRecord, ProgressResult } from './core/model';

export interface ReviewProblem {
  problem: ProblemDefinition;
  progress: ProgressRecord;
  accuracy: number;
}

function getResultPriority(result: ProgressResult): number {
  switch (result) {
    case 'error':
      return 0;
    case 'incorrect':
      return 1;
    case 'correct':
      return 2;
  }
}

export function getAccuracy(record: ProgressRecord): number {
  if (record.attempts === 0) {
    return 0;
  }
  return record.correct / record.attempts;
}

export function getReviewProblems(
  problems: ProblemDefinition[],
  progressRecords: ProgressRecord[],
  engine: EngineType
): ReviewProblem[] {
  const recordsByProblemId = new Map(
    progressRecords.filter((record) => record.engine === engine).map((record) => [record.problemId, record])
  );

  return problems
    .filter((problem) => problem.engine === engine)
    .map((problem) => {
      const progress = recordsByProblemId.get(problem.id);
      if (!progress || progress.attempts === 0) {
        return null;
      }
      return {
        problem,
        progress,
        accuracy: getAccuracy(progress)
      };
    })
    .filter((item): item is ReviewProblem => item !== null)
    .sort((left, right) => {
      const priorityDiff = getResultPriority(left.progress.lastResult) - getResultPriority(right.progress.lastResult);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      const accuracyDiff = left.accuracy - right.accuracy;
      if (accuracyDiff !== 0) {
        return accuracyDiff;
      }

      const answeredAtDiff = new Date(right.progress.lastAnsweredAt).getTime() - new Date(left.progress.lastAnsweredAt).getTime();
      if (answeredAtDiff !== 0) {
        return answeredAtDiff;
      }

      return left.problem.id.localeCompare(right.problem.id);
    });
}
