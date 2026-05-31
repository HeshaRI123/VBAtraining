import type { EngineType, ThemeExampleDefinition } from '../core/model';

export const themeExamples: ThemeExampleDefinition[] = [
  {
    id: 'example-xls-loop',
    engine: 'excel',
    title: 'ループのなぞり解き',
    category: 'ループ',
    difficulty: 1,
    prompt: '2 行目から 3 行目まで、A 列の値を C 列へ 2 倍して入れるんな',
    hints: ['For i = 2 To 3 を使うんな', 'Cells(i, 3).Value に代入するんな'],
    starter: 'Sub Main()\nDim i As Long\nFor i = 2 To 3\n\nNext\nEnd Sub',
    walkthroughSteps: [
      'For i = 2 To 3 で、2 行目と 3 行目を順番に見るんな。',
      '空いている行に、A 列を読んで C 列へ書く代入文を入れるんな。',
      'Cells(i, 1).Value が A 列、Cells(i, 3).Value が C 列なんな。'
    ],
    answer: 'Sub Main()\nDim i As Long\nFor i = 2 To 3\nCells(i, 3).Value = Cells(i, 1).Value * 2\nNext\nEnd Sub',
    lesson: {
      overview: '行番号だけを変えながら、同じ処理を繰り返す基本をなぞるんな。',
      steps: ['変数 i を用意するんな。', 'For で対象行を回すんな。', 'Cells の列番号を意識して代入するんな。'],
      focusItems: [
        {
          name: 'For',
          kind: 'statement',
          description: '決まった範囲を順番に繰り返す文なんな。',
          example: 'For i = 2 To 3'
        }
      ],
      reviewCards: [
        {
          question: 'Cells(i, 3).Value の 3 は何を表すんな。',
          answer: 'C 列なんな。列番号でセルの列を指定しているんな。'
        }
      ]
    },
    tags: ['For', 'Cells'],
    entryMode: 'fullModule',
    entryPoint: 'Main',
    args: [],
    initialSheet: {
      A1: '値',
      C1: '2倍',
      A2: 10,
      A3: 15
    },
    judge: {
      type: 'cell',
      expected: {
        C2: 20,
        C3: 30
      }
    }
  },
  {
    id: 'example-xls-string',
    engine: 'excel',
    title: '文字列のなぞり解き',
    category: '文字列',
    difficulty: 1,
    prompt: 'A2 の文字を大文字にして Debug.Print するんな',
    hints: ['UCase を使うんな', 'Debug.Print の後ろに表示したい値を書くんな'],
    starter: 'Sub Main()\nDim nameText As String\nnameText = Cells(2, 1).Value\nDebug.Print \nEnd Sub',
    walkthroughSteps: [
      'A2 の値は nameText に入っているんな。',
      'Debug.Print の後ろに UCase(nameText) を書くんな。',
      '実行結果に SATO と出れば、加工して表示できているんな。'
    ],
    answer: 'Sub Main()\nDim nameText As String\nnameText = Cells(2, 1).Value\nDebug.Print UCase(nameText)\nEnd Sub',
    lesson: {
      overview: 'セルから文字列を取り出し、関数で加工して表示する流れをなぞるんな。',
      steps: ['セルの値を変数に入れるんな。', 'UCase で大文字にするんな。', 'Debug.Print で確認するんな。'],
      focusItems: [
        {
          name: 'UCase',
          kind: 'function',
          description: '文字列を大文字に変える関数なんな。',
          example: 'UCase(nameText)'
        }
      ],
      reviewCards: [
        {
          question: '大文字化に使う関数は何なんな。',
          answer: 'UCase なんな。'
        }
      ]
    },
    tags: ['Debug.Print', 'UCase'],
    entryMode: 'fullModule',
    entryPoint: 'Main',
    args: [],
    initialSheet: {
      A1: 'name',
      A2: 'sato'
    },
    judge: {
      type: 'debug',
      expectedLines: ['SATO']
    }
  },
  {
    id: 'example-xls-array',
    engine: 'excel',
    title: '配列のなぞり解き',
    category: '配列',
    difficulty: 1,
    prompt: '1 始まり配列の 1 番目と 2 番目を足して返すんな',
    hints: ['nums(1) と nums(2) を足すんな', 'Function の戻り値は Main = で返すんな'],
    starter: 'Function Main()\nDim nums(1 To 2) As Long\nnums(1) = 3\nnums(2) = 5\nMain = \nEnd Function',
    walkthroughSteps: [
      'nums(1) に 3、nums(2) に 5 が入っているんな。',
      'Main = の右側に nums(1) + nums(2) を書くんな。',
      'Function では関数名に代入した値が戻り値になるんな。'
    ],
    answer: 'Function Main()\nDim nums(1 To 2) As Long\nnums(1) = 3\nnums(2) = 5\nMain = nums(1) + nums(2)\nEnd Function',
    lesson: {
      overview: '配列の添字で値を取り出し、Function の結果として返す流れをなぞるんな。',
      steps: ['配列へ値を入れるんな。', '添字を指定して値を読むんな。', 'Main = で戻り値を返すんな。'],
      focusItems: [
        {
          name: 'Main =',
          kind: 'syntax',
          description: 'Function の戻り値を返す書き方なんな。',
          example: 'Main = nums(1) + nums(2)'
        }
      ],
      reviewCards: [
        {
          question: 'Function で値を返すには何へ代入するんな。',
          answer: '関数名へ代入するんな。この例なら Main なんな。'
        }
      ]
    },
    tags: ['Function', 'Array'],
    entryMode: 'fullModule',
    entryPoint: 'Main',
    args: [],
    initialSheet: {
      A1: 'dummy'
    },
    judge: {
      type: 'return',
      expected: 8
    }
  },
  {
    id: 'example-acc-recordset',
    engine: 'access',
    title: 'Recordset のなぞり解き',
    category: 'Recordset',
    difficulty: 1,
    prompt: '顧客テーブルを開き、最初の 1 行の status を 済 に更新するんな',
    hints: ['OpenRecordset で開くんな', 'Edit、代入、Update の順なんな'],
    starter: 'Sub Main()\nDim rs As Variant\nSet rs = CurrentDb.OpenRecordset("顧客")\nrs.Edit\n\nrs.Update\nEnd Sub',
    walkthroughSteps: [
      'OpenRecordset で 顧客 テーブルの現在行を扱えるようにするんな。',
      'rs.Edit と rs.Update の間に、status を 済 にする代入を書くんな。',
      'rs.Fields("status") = "済" と書ければ更新できるんな。'
    ],
    answer: 'Sub Main()\nDim rs As Variant\nSet rs = CurrentDb.OpenRecordset("顧客")\nrs.Edit\nrs.Fields("status") = "済"\nrs.Update\nEnd Sub',
    lesson: {
      overview: 'Recordset の現在行を編集して確定する最小手順をなぞるんな。',
      steps: ['Recordset を開くんな。', 'Edit で編集を始めるんな。', 'Fields を代入して Update で確定するんな。'],
      focusItems: [
        {
          name: 'Edit',
          kind: 'method',
          description: '現在行の編集開始を示すメソッドなんな。',
          example: 'rs.Edit'
        }
      ],
      reviewCards: [
        {
          question: 'Recordset の変更を確定するメソッドは何なんな。',
          answer: 'Update なんな。'
        }
      ]
    },
    tags: ['Recordset', 'Edit', 'Update'],
    entryMode: 'fullModule',
    entryPoint: 'Main',
    args: [],
    initialDb: {
      顧客: {
        columns: ['id', 'name', 'status'],
        rows: [[1, 'A', '未']]
      }
    },
    judge: {
      type: 'table',
      table: '顧客',
      expectedRows: [[1, 'A', '済']]
    }
  },
  {
    id: 'example-acc-domain',
    engine: 'access',
    title: 'ドメイン集計のなぞり解き',
    category: 'ドメイン集計',
    difficulty: 1,
    prompt: '顧客テーブルの件数を DCount で数えて表示するんな',
    hints: ['第 1 引数は "*" なんな', '第 2 引数は "顧客" なんな'],
    starter: 'Sub Main()\nDebug.Print \nEnd Sub',
    walkthroughSteps: [
      'Debug.Print の後ろに DCount を書くんな。',
      '全部の件数を見るので、第 1 引数は "*" にするんな。',
      '顧客テーブルを数えるので、DCount("*", "顧客") と書くんな。'
    ],
    answer: 'Sub Main()\nDebug.Print DCount("*", "顧客")\nEnd Sub',
    lesson: {
      overview: 'DCount でテーブルの件数をすぐ確認する書き方をなぞるんな。',
      steps: ['数える対象を指定するんな。', 'テーブル名を指定するんな。', 'Debug.Print で表示するんな。'],
      focusItems: [
        {
          name: 'DCount',
          kind: 'function',
          description: '条件に合う件数を数える関数なんな。',
          example: 'DCount("*", "顧客")'
        }
      ],
      reviewCards: [
        {
          question: 'DCount("*", "顧客") は何を返すんな。',
          answer: '顧客テーブルの件数なんな。'
        }
      ]
    },
    tags: ['DCount', 'Debug.Print'],
    entryMode: 'fullModule',
    entryPoint: 'Main',
    args: [],
    initialDb: {
      顧客: {
        columns: ['id', 'name', 'status'],
        rows: [[1, 'A', '未'], [2, 'B', '済']]
      }
    },
    judge: {
      type: 'debug',
      expectedLines: ['2']
    }
  },
  {
    id: 'example-acc-query',
    engine: 'access',
    title: 'クエリのなぞり解き',
    category: 'クエリ',
    difficulty: 1,
    prompt: 'Main は空でよいので、判定 SQL が先頭 1 件を見ていることを確認するんな',
    hints: ['空の Sub Main で通るんな', 'TOP 1 の判定を読む練習なんな'],
    starter: 'Sub Main()\n\nEnd Sub',
    walkthroughSteps: [
      'この例題ではコードでテーブルを変えないんな。',
      '判定側の SQL が SELECT TOP 1 name FROM 顧客 ORDER BY id を見るんな。',
      '空の Main のまま実行し、A が取れることを確認するんな。'
    ],
    answer: 'Sub Main()\nEnd Sub',
    lesson: {
      overview: 'Access SQL の判定を読み、コードを書かない問題もあることをなぞるんな。',
      steps: ['SQL の SELECT を読むんな。', 'TOP 1 の意味を確認するんな。', '空の Main で実行するんな。'],
      focusItems: [
        {
          name: 'TOP',
          kind: 'syntax',
          description: '先頭から必要件数だけ取る SQL の書き方なんな。',
          example: 'SELECT TOP 1 name FROM 顧客'
        }
      ],
      reviewCards: [
        {
          question: 'TOP 1 は何件返すんな。',
          answer: '先頭 1 件なんな。'
        }
      ]
    },
    tags: ['Query', 'TOP'],
    entryMode: 'fullModule',
    entryPoint: 'Main',
    args: [],
    initialDb: {
      顧客: {
        columns: ['id', 'name', 'status'],
        rows: [[1, 'A', '未'], [2, 'B', '済']]
      }
    },
    judge: {
      type: 'query',
      sql: 'SELECT TOP 1 name FROM 顧客 ORDER BY id',
      expectedRows: [['A']],
      preserveOrder: true
    }
  },
  {
    id: 'example-acc-sql',
    engine: 'access',
    title: 'SQL 更新のなぞり解き',
    category: 'SQL',
    difficulty: 1,
    prompt: 'CurrentDb.Execute で 顧客 の status を 済 に更新するんな',
    hints: ['UPDATE 文を文字列で渡すんな', 'SET status = \'済\' と書くんな'],
    starter: 'Sub Main()\nCurrentDb.Execute()\nEnd Sub',
    walkthroughSteps: [
      'CurrentDb.Execute のかっこの中に SQL 文字列を入れるんな。',
      '更新なので UPDATE 顧客 SET status = \'済\' と書くんな。',
      '文字列全体をダブルクォートで囲むんな。'
    ],
    answer: 'Sub Main()\nCurrentDb.Execute("UPDATE 顧客 SET status = \'済\'")\nEnd Sub',
    lesson: {
      overview: 'SQL 文字列を Execute に渡して、まとめて更新する最小形をなぞるんな。',
      steps: ['Execute を呼ぶんな。', 'UPDATE 文を文字列にするんな。', '実行後のテーブルを確認するんな。'],
      focusItems: [
        {
          name: 'Execute',
          kind: 'method',
          description: 'SQL 文を実行するメソッドなんな。',
          example: 'CurrentDb.Execute("UPDATE 顧客 SET status = \'済\'")'
        }
      ],
      reviewCards: [
        {
          question: 'UPDATE 文を実行するときに使うメソッドは何なんな。',
          answer: 'CurrentDb.Execute なんな。'
        }
      ]
    },
    tags: ['Execute', 'Update'],
    entryMode: 'fullModule',
    entryPoint: 'Main',
    args: [],
    initialDb: {
      顧客: {
        columns: ['id', 'name', 'status'],
        rows: [[1, 'A', '未'], [2, 'B', '未']]
      }
    },
    judge: {
      type: 'table',
      table: '顧客',
      expectedRows: [[1, 'A', '済'], [2, 'B', '済']]
    }
  },
  {
    id: 'example-acc-master',
    engine: 'access',
    title: 'マスター参照のなぞり解き',
    category: 'マスター参照',
    difficulty: 1,
    prompt: '診療科マスターから deptCode が IM の deptName を DLookup で表示するんな',
    hints: ['DLookup を使うんな', '条件は deptCode = \'IM\' なんな'],
    starter: 'Sub Main()\nDebug.Print \nEnd Sub',
    walkthroughSteps: [
      'Debug.Print の後ろに DLookup を書くんな。',
      '取り出す列は deptName、テーブルは 診療科 なんな。',
      '条件に deptCode = \'IM\' を入れると 内科 が表示されるんな。'
    ],
    answer: 'Sub Main()\nDebug.Print DLookup("deptName", "診療科", "deptCode = \'IM\'")\nEnd Sub',
    lesson: {
      overview: 'コードから名称を取り出すマスター参照の最小形をなぞるんな。',
      steps: ['取り出す列を決めるんな。', '参照先テーブルを指定するんな。', '検索条件を文字列で渡すんな。'],
      focusItems: [
        {
          name: 'DLookup',
          kind: 'function',
          description: '条件に合う 1 件の値を取り出す関数なんな。',
          example: 'DLookup("deptName", "診療科", "deptCode = \'IM\'")'
        }
      ],
      reviewCards: [
        {
          question: 'コードから名称を引くときに使いやすい関数は何なんな。',
          answer: 'DLookup なんな。'
        }
      ]
    },
    tags: ['DLookup', 'Master'],
    entryMode: 'fullModule',
    entryPoint: 'Main',
    args: [],
    initialDb: {
      診療科: {
        columns: ['deptCode', 'deptName'],
        rows: [['IM', '内科']]
      }
    },
    judge: {
      type: 'debug',
      expectedLines: ['内科']
    }
  },
  {
    id: 'example-acc-worktable',
    engine: 'access',
    title: 'ワークテーブルのなぞり解き',
    category: 'ワークテーブル',
    difficulty: 1,
    prompt: '報告ワークに AddNew で 1 行追加するんな',
    hints: ['AddNew を使うんな', '最後は Update なんな'],
    starter: 'Sub Main()\nDim rs As Variant\nSet rs = CurrentDb.OpenRecordset("報告ワーク")\nrs.AddNew\n\nrs.Update\nEnd Sub',
    walkthroughSteps: [
      '報告ワークを Recordset として開くんな。',
      'AddNew と Update の間で、必要な Fields に値を入れるんな。',
      'staffId と outputStatus を入れて Update すれば 1 行追加できるんな。'
    ],
    answer: 'Sub Main()\nDim rs As Variant\nSet rs = CurrentDb.OpenRecordset("報告ワーク")\nrs.AddNew\nrs.Fields("staffId") = 101\nrs.Fields("outputStatus") = "出力対象"\nrs.Update\nEnd Sub',
    lesson: {
      overview: 'Excel 出力前に使うワークテーブルへ行を追加する基本形をなぞるんな。',
      steps: ['Recordset を開くんな。', 'AddNew で新規行を始めるんな。', 'Fields へ代入して Update で確定するんな。'],
      focusItems: [
        {
          name: 'AddNew',
          kind: 'method',
          description: 'Recordset に新しい行を追加し始めるメソッドなんな。',
          example: 'rs.AddNew'
        }
      ],
      reviewCards: [
        {
          question: 'Recordset で新規行を追加するとき、最初に呼ぶメソッドは何なんな。',
          answer: 'AddNew なんな。'
        }
      ]
    },
    tags: ['AddNew', 'WorkTable'],
    entryMode: 'fullModule',
    entryPoint: 'Main',
    args: [],
    initialDb: {
      報告ワーク: {
        columns: ['staffId', 'outputStatus'],
        rows: []
      }
    },
    judge: {
      type: 'table',
      table: '報告ワーク',
      expectedRows: [[101, '出力対象']]
    }
  }
];

export function getThemeExample(engine: EngineType, category: string): ThemeExampleDefinition | undefined {
  return themeExamples.find((example) => example.engine === engine && example.category === category);
}
