import type { JudgeResult, ProblemDefinition, RunResult, WorkerRequest, WorkerResponse } from '../core/model';

const WORKER_CLIENT_TIMEOUT_MS = 5_000;

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
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        this.worker.removeEventListener('message', handleMessage);
        this.worker.removeEventListener('error', handleError);
        this.worker.removeEventListener('messageerror', handleMessageError);
        window.clearTimeout(timeoutId);
      };
      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.requestId !== requestId) {
          return;
        }
        settled = true;
        cleanup();
        resolve({
          runResult: event.data.runResult,
          judgeResult: event.data.judgeResult
        });
      };
      const handleError = (event: ErrorEvent) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(new Error(event.message || 'Worker execution failed'));
      };
      const handleMessageError = () => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(new Error('Worker response could not be decoded'));
      };
      const timeoutId = window.setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(new Error('Worker execution timed out'));
      }, WORKER_CLIENT_TIMEOUT_MS);
      this.worker.addEventListener('message', handleMessage);
      this.worker.addEventListener('error', handleError);
      this.worker.addEventListener('messageerror', handleMessageError);
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
