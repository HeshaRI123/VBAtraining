import type { EngineType, ProgressRecord, ProgressResult } from './model';

const DB_NAME = 'vba-trainer';
const STORE_NAME = 'progress';
const DB_VERSION = 1;

interface AttemptInput {
  problemId: string;
  engine: EngineType;
  result: ProgressResult;
  durationMs: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'problemId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, handler: (store: IDBObjectStore) => Promise<T> | T): Promise<T> {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    Promise.resolve(handler(store)).then(resolve).catch(reject);
    transaction.onerror = () => reject(transaction.error);
  }).finally(() => {
    database.close();
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listProgressRecords(): Promise<ProgressRecord[]> {
  return withStore('readonly', async (store) => {
    const records = await requestToPromise(store.getAll() as IDBRequest<ProgressRecord[]>);
    return records.sort((left, right) => left.problemId.localeCompare(right.problemId));
  });
}

export async function getProgressRecord(problemId: string): Promise<ProgressRecord | undefined> {
  return withStore('readonly', async (store) => {
    const record = await requestToPromise(store.get(problemId) as IDBRequest<ProgressRecord | undefined>);
    return record;
  });
}

export async function saveAttempt(input: AttemptInput): Promise<ProgressRecord> {
  const existing = await getProgressRecord(input.problemId);
  const attempts = (existing?.attempts ?? 0) + 1;
  const correct = (existing?.correct ?? 0) + (input.result === 'correct' ? 1 : 0);
  const streak = input.result === 'correct' ? (existing?.streak ?? 0) + 1 : 0;
  const avgDurationMs = existing
    ? Math.round((existing.avgDurationMs * existing.attempts + input.durationMs) / attempts)
    : input.durationMs;
  const record: ProgressRecord = {
    problemId: input.problemId,
    engine: input.engine,
    attempts,
    correct,
    lastResult: input.result,
    streak,
    lastAnsweredAt: new Date().toISOString(),
    avgDurationMs
  };
  await withStore('readwrite', async (store) => {
    await requestToPromise(store.put(record));
  });
  return record;
}

export async function getEngineSummary(engine: EngineType): Promise<{
  totalAttempts: number;
  totalCorrect: number;
  accuracy: number;
}> {
  const records = await listProgressRecords();
  const filtered = records.filter((record) => record.engine === engine);
  const totalAttempts = filtered.reduce((sum, record) => sum + record.attempts, 0);
  const totalCorrect = filtered.reduce((sum, record) => sum + record.correct, 0);
  return {
    totalAttempts,
    totalCorrect,
    accuracy: totalAttempts === 0 ? 0 : totalCorrect / totalAttempts
  };
}
