import accessProblems from './access-problems.json';
import excelProblems from './excel-problems.json';
import type { EngineType, ProblemDefinition } from '../core/model';

export const problems = [...excelProblems, ...accessProblems] as ProblemDefinition[];

export function getProblemsByEngine(engine: EngineType): ProblemDefinition[] {
  return problems.filter((problem) => problem.engine === engine);
}

export function getProblemById(problemId: string): ProblemDefinition | undefined {
  return problems.find((problem) => problem.id === problemId);
}
