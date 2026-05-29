import { useEffect, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import type { JudgeResult, ProblemDefinition, ProgressRecord, RunResult } from './core/model';
import { getProblemsByEngine, problems } from './data/problems';
import { listProgressRecords, saveAttempt } from './core/storage';
import { ExecutionWorkerClient } from './worker/client';

function buildStarter(problem?: ProblemDefinition): string {
  if (!problem) {
    return '';
  }
  if (problem.entryMode === 'bodyOnly') {
    return '';
  }
  const firstLine = problem.answer.split('\n')[0] ?? `Sub ${problem.entryPoint}()`;
  const footer = firstLine.trim().toLowerCase().startsWith('function') ? 'End Function' : 'End Sub';
  return `${firstLine}\n\n${footer}`;
}

function formatRate(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function App() {
  const workerRef = useRef<ExecutionWorkerClient | null>(null);
  const [engine, setEngine] = useState<'excel' | 'access'>('excel');
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([]);
  const [selectedProblemId, setSelectedProblemId] = useState<string>(getProblemsByEngine('excel')[0]?.id ?? '');
  const [source, setSource] = useState<string>(() => buildStarter(getProblemsByEngine('excel')[0]));
  const [hintCount, setHintCount] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [judge, setJudge] = useState<JudgeResult | null>(null);

  const engineProblems = getProblemsByEngine(engine);
  const currentProblem = engineProblems.find((problem) => problem.id === selectedProblemId) ?? engineProblems[0];

  useEffect(() => {
    workerRef.current = new ExecutionWorkerClient();
    void refreshProgress();
    return () => {
      workerRef.current?.dispose();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const nextProblems = getProblemsByEngine(engine);
    const nextProblem = nextProblems.find((problem) => problem.id === selectedProblemId) ?? nextProblems[0];
    setSelectedProblemId(nextProblem?.id ?? '');
    setSource(nextProblem ? buildStarter(nextProblem) : '');
    setHintCount(0);
    setShowAnswer(false);
    setRunResult(null);
    setJudge(null);
  }, [engine]);

  useEffect(() => {
    if (!currentProblem) {
      return;
    }
    setSource(buildStarter(currentProblem));
    setHintCount(0);
    setShowAnswer(false);
    setRunResult(null);
    setJudge(null);
  }, [selectedProblemId]);

  async function refreshProgress(): Promise<void> {
    const records = await listProgressRecords();
    setProgressRecords(records);
  }

  async function handleRun(): Promise<void> {
    if (!currentProblem || !workerRef.current) {
      return;
    }
    setRunning(true);
    const { runResult: nextRunResult, judgeResult } = await workerRef.current.run(currentProblem, source);
    setRunResult(nextRunResult);
    setJudge(judgeResult);
    const result = !nextRunResult.ok ? 'error' : judgeResult.passed ? 'correct' : 'incorrect';
    await saveAttempt({
      problemId: currentProblem.id,
      engine: currentProblem.engine,
      result,
      durationMs: nextRunResult.durationMs
    });
    await refreshProgress();
    setRunning(false);
  }

  function handleNextProblem(): void {
    if (!currentProblem) {
      return;
    }
    const currentIndex = engineProblems.findIndex((problem) => problem.id === currentProblem.id);
    const nextProblem = engineProblems[(currentIndex + 1) % engineProblems.length];
    setSelectedProblemId(nextProblem.id);
  }

  const currentProgress = progressRecords.find((record) => record.problemId === currentProblem?.id);
  const engineProgress = progressRecords.filter((record) => record.engine === engine);
  const totalAttempts = engineProgress.reduce((sum, record) => sum + record.attempts, 0);
  const totalCorrect = engineProgress.reduce((sum, record) => sum + record.correct, 0);
  const accuracy = totalAttempts === 0 ? 0 : totalCorrect / totalAttempts;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <p className="eyebrow">Offline Drill</p>
          <h1>VBA Trainer</h1>
          <p className="muted">出題、記述、採点、進捗更新までをローカルで回すんな。</p>
        </div>

        <div className="panel">
          <div className="segment">
            <button
              className={engine === 'excel' ? 'segment-button active' : 'segment-button'}
              onClick={() => setEngine('excel')}
              type="button"
            >
              Excel
            </button>
            <button
              className={engine === 'access' ? 'segment-button active' : 'segment-button'}
              onClick={() => setEngine('access')}
              type="button"
            >
              Access
            </button>
          </div>
          <div className="stats-grid">
            <div>
              <span className="stats-label">挑戦回数</span>
              <strong>{totalAttempts}</strong>
            </div>
            <div>
              <span className="stats-label">正答率</span>
              <strong>{formatRate(accuracy)}</strong>
            </div>
          </div>
        </div>

        <div className="panel problem-list">
          <div className="panel-header">
            <h2>問題</h2>
            <span>{engineProblems.length}問</span>
          </div>
          {engineProblems.map((problem) => {
            const record = progressRecords.find((item) => item.problemId === problem.id);
            const selected = problem.id === currentProblem?.id;
            return (
              <button
                key={problem.id}
                className={selected ? 'problem-item selected' : 'problem-item'}
                onClick={() => setSelectedProblemId(problem.id)}
                type="button"
              >
                <div>
                  <strong>{problem.title}</strong>
                  <span>{problem.category}</span>
                </div>
                <small>{record ? `${record.correct}/${record.attempts}` : '未挑戦'}</small>
              </button>
            );
          })}
        </div>
      </aside>

      <main className="workspace">
        {currentProblem ? (
          <>
            <section className="problem-panel">
              <div className="problem-header">
                <div>
                  <p className="eyebrow">
                    {currentProblem.engine.toUpperCase()} / 難易度 {currentProblem.difficulty}
                  </p>
                  <h2>{currentProblem.title}</h2>
                </div>
                <button className="ghost-button" onClick={handleNextProblem} type="button">
                  次の問題
                </button>
              </div>
              <p className="prompt-text">{currentProblem.prompt}</p>
              <div className="tag-row">
                {currentProblem.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            </section>

            <section className="editor-panel">
              <div className="editor-header">
                <h2>コード</h2>
                <div className="editor-actions">
                  <button className="ghost-button" onClick={() => setHintCount((count) => Math.min(count + 1, currentProblem.hints.length))} type="button">
                    ヒント
                  </button>
                  <button className="ghost-button" onClick={() => setShowAnswer((value) => !value)} type="button">
                    模範解答
                  </button>
                  <button className="primary-button" disabled={running} onClick={() => void handleRun()} type="button">
                    {running ? '実行中...' : '実行して採点'}
                  </button>
                </div>
              </div>
              <CodeMirror
                value={source}
                height="360px"
                theme="light"
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: false
                }}
                onChange={(value) => setSource(value)}
              />
              {hintCount > 0 ? (
                <div className="hint-box">
                  <h3>ヒント</h3>
                  <ul>
                    {currentProblem.hints.slice(0, hintCount).map((hint) => (
                      <li key={hint}>{hint}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {showAnswer ? (
                <div className="answer-box">
                  <h3>模範解答</h3>
                  <pre>{currentProblem.answer}</pre>
                </div>
              ) : null}
            </section>

            <section className="result-grid">
              <article className="panel result-panel">
                <div className="panel-header">
                  <h2>採点結果</h2>
                  {judge ? <span className={judge.passed ? 'pill success' : 'pill danger'}>{judge.passed ? '合格' : '再挑戦'}</span> : null}
                </div>
                <p>{judge?.summary ?? 'まだ採点していないんな'}</p>
                {runResult?.diagnostics.length ? (
                  <div className="diagnostics">
                    {runResult.diagnostics.map((diagnostic, index) => (
                      <div key={`${diagnostic.message}-${index}`} className="diagnostic-item">
                        <strong>{diagnostic.kind}</strong>
                        <span>{diagnostic.message}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {runResult?.debugLines.length ? (
                  <div className="debug-output">
                    <h3>Debug.Print</h3>
                    <pre>{runResult.debugLines.join('\n')}</pre>
                  </div>
                ) : null}
              </article>

              <article className="panel result-panel">
                <div className="panel-header">
                  <h2>進捗</h2>
                  <span>{currentProgress ? `${currentProgress.correct}/${currentProgress.attempts}` : '未挑戦'}</span>
                </div>
                <div className="progress-metrics">
                  <div>
                    <span className="stats-label">連続正解</span>
                    <strong>{currentProgress?.streak ?? 0}</strong>
                  </div>
                  <div>
                    <span className="stats-label">平均解答時間</span>
                    <strong>{currentProgress ? `${currentProgress.avgDurationMs}ms` : '0ms'}</strong>
                  </div>
                </div>
                <div className="stats-grid wide">
                  <div>
                    <span className="stats-label">総問題数</span>
                    <strong>{problems.filter((problem) => problem.engine === engine).length}</strong>
                  </div>
                  <div>
                    <span className="stats-label">正答率</span>
                    <strong>{formatRate(accuracy)}</strong>
                  </div>
                </div>
              </article>
            </section>
          </>
        ) : (
          <section className="empty-state">
            <h2>問題がないんな</h2>
          </section>
        )}
      </main>
    </div>
  );
}
