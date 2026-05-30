import { useEffect, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import type { JudgeResult, ProblemDefinition, ProgressRecord, ProgressResult, RunResult } from './core/model';
import { getProblemsByEngine, problems } from './data/problems';
import { getThemeExample } from './data/theme-examples';
import { listProgressRecords, saveAttempt } from './core/storage';
import { createProblemAutocompletion } from './editor/autocomplete';
import { getReviewProblems } from './review';
import { ExecutionWorkerClient } from './worker/client';

type StudyMode = 'practice' | 'review';

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

function getResultLabel(result: ProgressResult): string {
  switch (result) {
    case 'correct':
      return '合格';
    case 'incorrect':
      return '再挑戦';
    case 'error':
      return '実行エラー';
  }
}

function createWorkerFailureResult(error: unknown): { runResult: RunResult; judgeResult: JudgeResult } {
  const message = error instanceof Error ? error.message : 'Worker execution failed';
  const runResult: RunResult = {
    ok: false,
    diagnostics: [
      {
        kind: message.includes('timed out') ? 'Timeout' : 'Runtime',
        severity: 'error',
        message: `実行ワーカーでエラーが起きたんな: ${message}`
      }
    ],
    debugLines: [],
    snapshot: {},
    durationMs: 0
  };
  return {
    runResult,
    judgeResult: {
      passed: false,
      summary: '実行エラーで採点できなかったんな',
      diagnostics: runResult.diagnostics
    }
  };
}

function getResultClass(result: ProgressResult): string {
  switch (result) {
    case 'correct':
      return 'pill success';
    case 'incorrect':
      return 'pill warning';
    case 'error':
      return 'pill danger';
  }
}

export default function App() {
  const workerRef = useRef<ExecutionWorkerClient | null>(null);
  const resultPanelRef = useRef<HTMLElement | null>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const shouldRevealResultRef = useRef(false);

  const [studyMode, setStudyMode] = useState<StudyMode>('practice');
  const [engine, setEngine] = useState<'excel' | 'access'>('excel');
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([]);
  const [selectedProblemId, setSelectedProblemId] = useState<string>(getProblemsByEngine('excel')[0]?.id ?? '');
  const [source, setSource] = useState<string>(() => buildStarter(getProblemsByEngine('excel')[0]));
  const [hintCount, setHintCount] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showLessonIntro, setShowLessonIntro] = useState(true);
  const [exampleSource, setExampleSource] = useState<string>(() => getThemeExample('excel', getProblemsByEngine('excel')[0]?.category ?? '')?.starter ?? '');
  const [exampleRunResult, setExampleRunResult] = useState<RunResult | null>(null);
  const [exampleJudge, setExampleJudge] = useState<JudgeResult | null>(null);
  const [reviewAnswers, setReviewAnswers] = useState<Record<string, boolean>>({});
  const [running, setRunning] = useState(false);
  const [runningExample, setRunningExample] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [judge, setJudge] = useState<JudgeResult | null>(null);

  const engineProblems = getProblemsByEngine(engine);
  const currentProblem = engineProblems.find((problem) => problem.id === selectedProblemId) ?? engineProblems[0];
  const currentThemeExample = currentProblem ? getThemeExample(currentProblem.engine, currentProblem.category) : undefined;
  const reviewProblems = getReviewProblems(problems, progressRecords, engine);

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
    setShowLessonIntro(true);
    setExampleSource(getThemeExample(nextProblem?.engine ?? engine, nextProblem?.category ?? '')?.starter ?? '');
    setExampleRunResult(null);
    setExampleJudge(null);
    setReviewAnswers({});
    setRunResult(null);
    setJudge(null);
    shouldRevealResultRef.current = false;
  }, [engine]);

  useEffect(() => {
    if (!currentProblem) {
      return;
    }
    setSource(buildStarter(currentProblem));
    setHintCount(0);
    setShowAnswer(false);
    setShowLessonIntro(true);
    setExampleSource(getThemeExample(currentProblem.engine, currentProblem.category)?.starter ?? '');
    setExampleRunResult(null);
    setExampleJudge(null);
    setRunResult(null);
    setJudge(null);
    shouldRevealResultRef.current = false;
  }, [selectedProblemId]);

  useEffect(() => {
    if (!judge || !shouldRevealResultRef.current || !resultPanelRef.current || !resultHeadingRef.current) {
      return;
    }

    const revealResult = () => {
      resultPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      resultHeadingRef.current?.focus();
      shouldRevealResultRef.current = false;
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      const frameId = window.requestAnimationFrame(revealResult);
      return () => window.cancelAnimationFrame(frameId);
    }

    revealResult();
    return undefined;
  }, [judge]);

  async function refreshProgress(): Promise<void> {
    const records = await listProgressRecords();
    setProgressRecords(records);
  }

  async function handleRun(): Promise<void> {
    if (!currentProblem || !workerRef.current) {
      return;
    }

    setRunning(true);
    try {
      let nextRunResult: RunResult;
      let nextJudgeResult: JudgeResult;
      try {
        const result = await workerRef.current.run(currentProblem, source);
        nextRunResult = result.runResult;
        nextJudgeResult = result.judgeResult;
      } catch (error) {
        const result = createWorkerFailureResult(error);
        nextRunResult = result.runResult;
        nextJudgeResult = result.judgeResult;
      }
      shouldRevealResultRef.current = true;
      setRunResult(nextRunResult);
      setJudge(nextJudgeResult);

      const result: ProgressResult = !nextRunResult.ok ? 'error' : nextJudgeResult.passed ? 'correct' : 'incorrect';
      await saveAttempt({
        problemId: currentProblem.id,
        engine: currentProblem.engine,
        result,
        durationMs: nextRunResult.durationMs
      });
      await refreshProgress();
    } finally {
      setRunning(false);
    }
  }

  async function handleRunExample(): Promise<void> {
    if (!currentThemeExample || !workerRef.current) {
      return;
    }

    setRunningExample(true);
    try {
      let nextRunResult: RunResult;
      let nextJudgeResult: JudgeResult;
      try {
        const result = await workerRef.current.run(currentThemeExample, exampleSource);
        nextRunResult = result.runResult;
        nextJudgeResult = result.judgeResult;
      } catch (error) {
        const result = createWorkerFailureResult(error);
        nextRunResult = result.runResult;
        nextJudgeResult = result.judgeResult;
      }
      setExampleRunResult(nextRunResult);
      setExampleJudge(nextJudgeResult);
    } finally {
      setRunningExample(false);
    }
  }

  function handleNextProblem(): void {
    if (!currentProblem) {
      return;
    }
    const currentIndex = engineProblems.findIndex((problem) => problem.id === currentProblem.id);
    const nextProblem = engineProblems[(currentIndex + 1) % engineProblems.length];
    setSelectedProblemId(nextProblem.id);
  }

  function handleOpenReviewProblem(problemId: string): void {
    setStudyMode('practice');
    setSelectedProblemId(problemId);
  }

  function toggleReviewAnswer(cardKey: string): void {
    setReviewAnswers((current) => ({
      ...current,
      [cardKey]: !current[cardKey]
    }));
  }

  const currentProgress = progressRecords.find((record) => record.problemId === currentProblem?.id);
  const engineProgress = progressRecords.filter((record) => record.engine === engine);
  const totalAttempts = engineProgress.reduce((sum, record) => sum + record.attempts, 0);
  const totalCorrect = engineProgress.reduce((sum, record) => sum + record.correct, 0);
  const accuracy = totalAttempts === 0 ? 0 : totalCorrect / totalAttempts;
  const liveResultMessage = judge
    ? `採点完了。${judge.passed ? '合格なんな。' : '合格ではなかったんな。'}${judge.summary}`
    : '';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <p className="eyebrow">Offline Drill</p>
          <h1>VBA Trainer</h1>
          <p className="muted">出題、記述、採点、進捗更新までをローカルで回すんな。</p>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>モード</h2>
          </div>
          <div className="segment">
            <button
              className={studyMode === 'practice' ? 'segment-button active' : 'segment-button'}
              onClick={() => setStudyMode('practice')}
              type="button"
            >
              演習
            </button>
            <button
              className={studyMode === 'review' ? 'segment-button active' : 'segment-button'}
              onClick={() => setStudyMode('review')}
              type="button"
            >
              復習
            </button>
          </div>
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
        {studyMode === 'review' ? (
          <section className="review-shell">
            <div className="problem-panel">
              <div className="problem-header">
                <div>
                  <p className="eyebrow">
                    {engine.toUpperCase()} / 復習
                  </p>
                  <h2>復習カード</h2>
                </div>
                <span>{reviewProblems.length}問</span>
              </div>
              <p className="prompt-text">一度触った問題だけを、問いと答えで見直せるようにしたんな。</p>
            </div>

            {reviewProblems.length ? (
              <div className="review-list">
                {reviewProblems.map(({ problem, progress, accuracy: reviewAccuracy }) => (
                  <article key={problem.id} className="panel review-problem">
                    <div className="panel-header">
                      <div>
                        <h3>{problem.title}</h3>
                        <p className="muted review-meta">
                          {problem.category} / 正答率 {formatRate(reviewAccuracy)}
                        </p>
                      </div>
                      <span className={getResultClass(progress.lastResult)}>{getResultLabel(progress.lastResult)}</span>
                    </div>
                    <div className="review-cards">
                      {problem.lesson.reviewCards.map((card, index) => {
                        const cardKey = `${problem.id}-${index}`;
                        const isOpen = reviewAnswers[cardKey] ?? false;
                        return (
                          <section key={cardKey} className="review-card">
                            <p className="eyebrow">復習カード {index + 1}</p>
                            <p className="review-question">{card.question}</p>
                            {isOpen ? <p className="review-answer">{card.answer}</p> : null}
                            <div className="review-actions">
                              <button className="ghost-button" onClick={() => toggleReviewAnswer(cardKey)} type="button">
                                {isOpen ? '答えを隠す' : '答えを見る'}
                              </button>
                              <button className="primary-button" onClick={() => handleOpenReviewProblem(problem.id)} type="button">
                                この問題に戻る
                              </button>
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <section className="panel empty-state">
                <h2>まだ復習カードはないんな</h2>
                <p className="muted">まずはどれか 1 問解いてから、ここで見直せるんな。</p>
              </section>
            )}
          </section>
        ) : currentProblem ? (
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

              {showLessonIntro && currentThemeExample ? (
                <div className="lesson-box theme-example-box">
                  <div className="lesson-header">
                    <div>
                      <p className="eyebrow">テーマ例題 / {currentProblem.category}</p>
                      <h3>{currentThemeExample.title}</h3>
                    </div>
                    <button className="ghost-button" onClick={() => setShowLessonIntro(false)} type="button">
                      例題を飛ばす
                    </button>
                  </div>
                  <p className="prompt-text">{currentThemeExample.prompt}</p>
                  <div className="theme-example-grid">
                    <section>
                      <h4>なぞり解き</h4>
                      <ol className="lesson-steps">
                        {currentThemeExample.walkthroughSteps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </section>
                    <section>
                      <h4>確認すること</h4>
                      <div className="focus-list">
                        {currentThemeExample.lesson.focusItems.map((item) => (
                          <article key={`${currentThemeExample.id}-${item.name}`} className="focus-item">
                            <div className="focus-item-header">
                              <strong>{item.name}</strong>
                              <span className="tag subtle">{item.kind}</span>
                            </div>
                            <p>{item.description}</p>
                            <code>{item.example}</code>
                          </article>
                        ))}
                      </div>
                    </section>
                  </div>

                  <div className="example-editor">
                    <div className="editor-header">
                      <h4>例題コード</h4>
                      <button className="primary-button" disabled={runningExample} onClick={() => void handleRunExample()} type="button">
                        {runningExample ? '例題を採点中...' : '例題を採点'}
                      </button>
                    </div>
                    <CodeMirror
                      value={exampleSource}
                      height="240px"
                      theme="light"
                      basicSetup={{
                        lineNumbers: true,
                        foldGutter: false,
                        autocompletion: false
                      }}
                      extensions={[createProblemAutocompletion(currentThemeExample)]}
                      onChange={(value) => setExampleSource(value)}
                    />
                  </div>

                  <div className={exampleJudge?.passed ? 'example-result success' : 'example-result'}>
                    <div>
                      <strong>例題の採点結果</strong>
                      <p>{exampleJudge?.summary ?? 'まだ例題を採点していないんな'}</p>
                    </div>
                    {exampleJudge?.passed ? (
                      <button className="primary-button" onClick={() => setShowLessonIntro(false)} type="button">
                        本問を書く
                      </button>
                    ) : null}
                  </div>
                  {exampleRunResult?.diagnostics.length ? (
                    <div className="diagnostics">
                      {exampleRunResult.diagnostics.map((diagnostic, index) => (
                        <div key={`${diagnostic.message}-${index}`} className="diagnostic-item">
                          <strong>{diagnostic.kind}</strong>
                          <span>{diagnostic.message}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : showLessonIntro ? (
                <div className="lesson-box">
                  <div className="lesson-header">
                    <div>
                      <p className="eyebrow">先に確認すること</p>
                      <h3>この問題の進め方</h3>
                    </div>
                    <button className="primary-button" onClick={() => setShowLessonIntro(false)} type="button">
                      書いてみる
                    </button>
                  </div>
                  <p className="prompt-text">{currentProblem.lesson.overview}</p>
                  <div className="lesson-grid">
                    <section>
                      <h4>使うもの</h4>
                      <div className="focus-list">
                        {currentProblem.lesson.focusItems.map((item) => (
                          <article key={`${currentProblem.id}-${item.name}`} className="focus-item">
                            <div className="focus-item-header">
                              <strong>{item.name}</strong>
                              <span className="tag subtle">{item.kind}</span>
                            </div>
                            <p>{item.description}</p>
                            <code>{item.example}</code>
                          </article>
                        ))}
                      </div>
                    </section>
                    <section>
                      <h4>進め方</h4>
                      <ol className="lesson-steps">
                        {currentProblem.lesson.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </section>
                  </div>
                </div>
              ) : null}

              <CodeMirror
                value={source}
                height="360px"
                theme="light"
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: false,
                  autocompletion: false
                }}
                extensions={[createProblemAutocompletion(currentProblem)]}
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
              <article className="panel result-panel" ref={resultPanelRef}>
                <span className="sr-only" aria-live="polite">
                  {liveResultMessage}
                </span>
                <div className="panel-header">
                  <h2 ref={resultHeadingRef} tabIndex={-1}>
                    採点結果
                  </h2>
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
