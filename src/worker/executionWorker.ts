import { judgeResult, runSubmission } from '../core/engine';
import type { WorkerRequest, WorkerResponse } from '../core/model';

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const { requestId, problem, source } = event.data;
  const runResult = await runSubmission(problem, source);
  const result: WorkerResponse = {
    requestId,
    runResult,
    judgeResult: judgeResult(problem, runResult)
  };
  self.postMessage(result);
});
