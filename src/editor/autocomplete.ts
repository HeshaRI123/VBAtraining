import { autocompletion, snippetCompletion, type Completion, type CompletionSource } from '@codemirror/autocomplete';
import type { Extension } from '@codemirror/state';
import type { EngineType, LessonFocusItem, LessonFocusItemKind, ProblemDefinition } from '../core/model';

const KEYWORD_COMPLETIONS: Completion[] = [
  { label: 'Dim', type: 'keyword', info: '変数を宣言するときに使うんな。' },
  { label: 'If', type: 'keyword', info: '条件分岐の始まりなんな。' },
  { label: 'Then', type: 'keyword', info: 'If の条件成立後に続けるキーワードなんな。' },
  { label: 'Else', type: 'keyword', info: '条件に当てはまらないときの分岐なんな。' },
  { label: 'For', type: 'keyword', info: '回数が決まっている繰り返しに使うんな。' },
  { label: 'Next', type: 'keyword', info: 'For を閉じるキーワードなんな。' },
  { label: 'Do While', type: 'keyword', info: '条件付きの繰り返しに使うんな。' },
  { label: 'Loop', type: 'keyword', info: 'Do While を閉じるキーワードなんな。' },
  { label: 'Select Case', type: 'keyword', info: '値ごとの分岐に使うんな。' },
  { label: 'End', type: 'keyword', info: 'Sub や If などを閉じるキーワードなんな。' },
  { label: 'Sub', type: 'keyword', info: '戻り値のない手続きを定義するときに使うんな。' },
  { label: 'Function', type: 'keyword', info: '戻り値のある手続きを定義するときに使うんな。' },
  { label: 'Set', type: 'keyword', info: 'オブジェクトを代入するときに使うんな。' },
  { label: 'Debug.Print', type: 'keyword', info: '確認したい値を出力するときに使うんな。' }
];

const SNIPPET_COMPLETIONS: Completion[] = [
  snippetCompletion('If ${condition} Then\n\t${}\nEnd If', {
    label: 'If ... End If',
    type: 'keyword',
    detail: 'snippet',
    info: 'If 文のひな形なんな。'
  }),
  snippetCompletion('For ${index} = ${start} To ${end}\n\t${}\nNext', {
    label: 'For ... Next',
    type: 'keyword',
    detail: 'snippet',
    info: 'For ループのひな形なんな。'
  }),
  snippetCompletion('Do While ${condition}\n\t${}\nLoop', {
    label: 'Do While ... Loop',
    type: 'keyword',
    detail: 'snippet',
    info: 'Do While ループのひな形なんな。'
  }),
  snippetCompletion('Select Case ${value}\nCase ${target}\n\t${}\nEnd Select', {
    label: 'Select Case ... End Select',
    type: 'keyword',
    detail: 'snippet',
    info: 'Select Case のひな形なんな。'
  })
];

const ENGINE_GLOBAL_COMPLETIONS: Record<EngineType, Completion[]> = {
  excel: [
    { label: 'Cells', type: 'function', detail: 'Excel', info: 'Cells(row, column) でセルを参照するんな。' },
    { label: 'Range', type: 'function', detail: 'Excel', info: 'Range("A1") の形でセル範囲を参照するんな。' }
  ],
  access: [
    { label: 'CurrentDb', type: 'variable', detail: 'Access', info: '現在のデータベースを表すオブジェクトなんな。' },
    { label: 'DoCmd', type: 'variable', detail: 'Access', info: 'SQL 実行などの命令をまとめたオブジェクトなんな。' },
    { label: 'DLookup', type: 'function', detail: 'Access', info: '条件に合う1件の値を取り出す関数なんな。' },
    { label: 'DCount', type: 'function', detail: 'Access', info: '条件に合う件数を数える関数なんな。' },
    { label: 'DSum', type: 'function', detail: 'Access', info: '条件に合う数値の合計を出す関数なんな。' }
  ]
};

const MEMBER_COMPLETIONS: Record<string, Completion[]> = {
  excelvalue: [{ label: 'Value', type: 'property', info: 'セルや Range の値を読み書きするプロパティなんな。' }],
  currentdb: [
    { label: 'OpenRecordset', type: 'method', info: 'テーブルや SELECT 結果を Recordset として開くんな。' },
    { label: 'Execute', type: 'method', info: 'UPDATE などの SQL を実行するんな。' }
  ],
  docmd: [{ label: 'RunSQL', type: 'method', info: 'SQL 文をそのまま実行するんな。' }],
  recordset: [
    { label: 'EOF', type: 'property', info: 'データ末尾まで進んだかどうかを返すんな。' },
    { label: 'Fields', type: 'method', info: '列名を指定して値を読み書きするんな。' },
    { label: 'MoveNext', type: 'method', info: '次の行へ進むんな。' },
    { label: 'Edit', type: 'method', info: '現在行の編集を始めるんな。' },
    { label: 'Update', type: 'method', info: 'Edit や AddNew の変更を確定するんな。' },
    { label: 'Delete', type: 'method', info: '現在行を削除するんな。' },
    { label: 'AddNew', type: 'method', info: '新しい行の追加を始めるんな。' }
  ]
};

interface CompletionQueryResult {
  from: number;
  options: Completion[];
}

function mapLessonKindToCompletionType(kind: LessonFocusItemKind): Completion['type'] {
  switch (kind) {
    case 'function':
      return 'function';
    case 'method':
      return 'method';
    case 'property':
      return 'property';
    case 'object':
      return 'variable';
    default:
      return 'keyword';
  }
}

function toFocusItemCompletion(item: LessonFocusItem): Completion {
  return {
    label: item.name,
    type: mapLessonKindToCompletionType(item.kind),
    detail: item.kind,
    info: `${item.description}\n例: ${item.example}`
  };
}

function dedupeCompletions(completions: Completion[]): Completion[] {
  const unique = new Map<string, Completion>();
  for (const completion of completions) {
    const key = completion.label.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, completion);
    }
  }
  return [...unique.values()];
}

function filterCompletions(completions: Completion[], prefix: string): Completion[] {
  if (!prefix) {
    return completions;
  }
  const normalizedPrefix = prefix.toLowerCase();
  return completions.filter((completion) => completion.label.toLowerCase().startsWith(normalizedPrefix));
}

function resolveMemberCatalog(engine: EngineType, beforeCursor: string): { key: string; prefix: string } | null {
  const currentDbMatch = beforeCursor.match(/CurrentDb\.(\w*)$/i);
  if (currentDbMatch) {
    return { key: 'currentdb', prefix: currentDbMatch[1] ?? '' };
  }

  const doCmdMatch = beforeCursor.match(/DoCmd\.(\w*)$/i);
  if (doCmdMatch) {
    return { key: 'docmd', prefix: doCmdMatch[1] ?? '' };
  }

  const recordsetMatch = beforeCursor.match(/\brs\.(\w*)$/i);
  if (recordsetMatch) {
    return { key: 'recordset', prefix: recordsetMatch[1] ?? '' };
  }

  if (engine === 'excel' && /(?:Cells(?:\([^)]*\))?|Range(?:\([^)]*\))?)\.(\w*)$/i.test(beforeCursor)) {
    const cellMatch = beforeCursor.match(/(?:Cells(?:\([^)]*\))?|Range(?:\([^)]*\))?)\.(\w*)$/i);
    return { key: 'excelvalue', prefix: cellMatch?.[1] ?? '' };
  }

  return null;
}

export function getTopLevelCompletions(problem: ProblemDefinition): Completion[] {
  return dedupeCompletions([
    ...KEYWORD_COMPLETIONS,
    ...SNIPPET_COMPLETIONS,
    ...ENGINE_GLOBAL_COMPLETIONS[problem.engine],
    ...problem.lesson.focusItems.map(toFocusItemCompletion)
  ]);
}

export function getMemberCompletions(engine: EngineType, beforeCursor: string): Completion[] {
  const match = resolveMemberCatalog(engine, beforeCursor);
  if (!match) {
    return [];
  }
  return filterCompletions(MEMBER_COMPLETIONS[match.key] ?? [], match.prefix);
}

export function getCompletionResult(problem: ProblemDefinition, beforeCursor: string, explicit: boolean): CompletionQueryResult | null {
  const memberMatch = resolveMemberCatalog(problem.engine, beforeCursor);
  if (memberMatch) {
    const options = filterCompletions(MEMBER_COMPLETIONS[memberMatch.key] ?? [], memberMatch.prefix);
    if (!options.length) {
      return null;
    }
    return {
      from: beforeCursor.length - memberMatch.prefix.length,
      options
    };
  }

  const wordMatch = beforeCursor.match(/[A-Za-z_][A-Za-z0-9_.]*$/);
  if (!wordMatch && !explicit) {
    return null;
  }

  const prefix = wordMatch?.[0] ?? '';
  const options = filterCompletions(getTopLevelCompletions(problem), prefix);
  if (!options.length) {
    return null;
  }

  return {
    from: beforeCursor.length - prefix.length,
    options
  };
}

export function createProblemAutocompletion(problem: ProblemDefinition): Extension {
  const source: CompletionSource = (context) => {
    const beforeCursor = context.state.sliceDoc(0, context.pos);
    const result = getCompletionResult(problem, beforeCursor, context.explicit);
    if (!result) {
      return null;
    }
    return {
      from: result.from,
      options: result.options,
      validFor: /^\w*$/
    };
  };

  return autocompletion({
    override: [source],
    activateOnTyping: true
  });
}
