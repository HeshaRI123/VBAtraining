import type { JudgeResult, ProblemDefinition, RunResult, WorkerRequest, WorkerResponse } from '../core/model';

export class ExecutionWorkerClient {
  private readonly worker: Worker;

  constructor() {
    this.worker = new Worker(new URL('./executionWorker.ts', import.meta.url), { type: 'module' });
  }

  run(problem: ProblemDefinition, source: string): Promise<{
    runResult: RunResult;
    judgeResult: JudgeResult;
  }> {
    const requestId = crypto.randomUUID();
    return new Promise((resolve) => {
      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.requestId !== requestId) {
          return;
        }
        this.worker.removeEventListener('message', handleMessage);
        resolve({
          runResult: event.data.runResult,
          judgeResult: event.data.judgeResult
        });
      };
      this.worker.addEventListener('message', handleMessage);
      const payload: WorkerRequest = {
        requestId,
        problem,
        source
      };
      this.worker.postMessage(payload);
    });
  }

  dispose(): void {
    this.worker.terminate();
  }
}
