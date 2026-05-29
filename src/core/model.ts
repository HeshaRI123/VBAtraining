export type EngineType = 'excel' | 'access';
export type EntryMode = 'fullModule' | 'bodyOnly';
export type DiagnosticKind =
  | 'Syntax'
  | 'UnsupportedSyntax'
  | 'Runtime'
  | 'Timeout'
  | 'StepLimit'
  | 'MemoryLimit'
  | 'Validation';
export type DiagnosticSeverity = 'error' | 'warning';
export type JudgeType = 'cell' | 'debug' | 'return' | 'table' | 'query';
export type ProgressResult = 'correct' | 'incorrect' | 'error';

export interface SourcePosition {
  line: number;
  column: number;
  offset: number;
}

export interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}

export interface Diagnostic {
  kind: DiagnosticKind;
  severity: DiagnosticSeverity;
  message: string;
  range?: SourceRange;
}

export interface EntrySpec {
  entryMode: EntryMode;
  entryPoint: string;
  args: unknown[];
}

export interface CellJudgeSpec {
  type: 'cell';
  expected: Record<string, unknown>;
  epsilon?: number;
}

export interface DebugJudgeSpec {
  type: 'debug';
  expectedLines: string[];
}

export interface ReturnJudgeSpec {
  type: 'return';
  expected: unknown;
  epsilon?: number;
}

export interface TableJudgeSpec {
  type: 'table';
  table: string;
  expectedRows: unknown[][];
  preserveOrder?: boolean;
  epsilon?: number;
}

export interface QueryJudgeSpec {
  type: 'query';
  sql: string;
  expectedRows: unknown[][];
  preserveOrder?: boolean;
  epsilon?: number;
}

export type JudgeSpec =
  | CellJudgeSpec
  | DebugJudgeSpec
  | ReturnJudgeSpec
  | TableJudgeSpec
  | QueryJudgeSpec;

export interface SheetState {
  [cellAddress: string]: unknown;
}

export interface TableState {
  columns: string[];
  rows: unknown[][];
}

export interface DatabaseState {
  [tableName: string]: TableState;
}

export interface ProblemDefinition {
  id: string;
  engine: EngineType;
  title: string;
  category: string;
  difficulty: number;
  prompt: string;
  hints: string[];
  answer: string;
  tags: string[];
  entryMode: EntryMode;
  entryPoint: string;
  args: unknown[];
  judge: JudgeSpec;
  initialSheet?: SheetState;
  initialDb?: DatabaseState;
}

export interface ProgressRecord {
  problemId: string;
  engine: EngineType;
  attempts: number;
  correct: number;
  lastResult: ProgressResult;
  streak: number;
  lastAnsweredAt: string;
  avgDurationMs: number;
}

export interface EngineLimits {
  maxSteps: number;
  timeoutMs: number;
  maxArrayElements: number;
  maxCells: number;
  maxRowsPerTable: number;
  maxEstimatedBytes: number;
}

export interface CoercionRule {
  operatorGroup: 'arithmetic' | 'comparison' | 'concatenation';
  left: string;
  right: string;
  result: string;
  notes: string;
}

export interface SemanticsProfile {
  optionExplicit: true;
  caseInsensitiveIdentifiers: true;
  defaultArgumentMode: 'ByRef';
  requireSetForObjectAssignment: true;
  excelRequiresExplicitValueMember: true;
  supportedStringFunctions: string[];
  supportedConversionFunctions: string[];
  unsupportedFeatures: string[];
  coercionMatrix: CoercionRule[];
}

export interface EngineCapabilityManifest {
  engine: EngineType;
  supportedStatements: string[];
  supportedFunctions: string[];
  supportedObjects: string[];
  unsupportedFeatures: string[];
}

export interface ValidationResult {
  valid: boolean;
  diagnostics: Diagnostic[];
}

export interface ValidationSummary {
  valid: boolean;
  results: Array<{
    problemId: string;
    valid: boolean;
    diagnostics: Diagnostic[];
  }>;
}

export interface HostSnapshot {
  sheet?: Record<string, unknown>;
  tables?: Record<string, unknown[][]>;
  queries?: Record<string, unknown[][]>;
}

export interface RunResult {
  ok: boolean;
  diagnostics: Diagnostic[];
  debugLines: string[];
  returnValue?: unknown;
  snapshot: HostSnapshot;
  durationMs: number;
}

export interface JudgeResult {
  passed: boolean;
  summary: string;
  diagnostics: Diagnostic[];
}

export const DEFAULT_LIMITS: EngineLimits = {
  maxSteps: 20_000,
  timeoutMs: 500,
  maxArrayElements: 10_000,
  maxCells: 2_000,
  maxRowsPerTable: 2_000,
  maxEstimatedBytes: 4_000_000
};

export const DEFAULT_EPSILON = 1e-9;

export const SEMANTICS_PROFILE: SemanticsProfile = {
  optionExplicit: true,
  caseInsensitiveIdentifiers: true,
  defaultArgumentMode: 'ByRef',
  requireSetForObjectAssignment: true,
  excelRequiresExplicitValueMember: true,
  supportedStringFunctions: [
    'Len',
    'Left',
    'Right',
    'Mid',
    'InStr',
    'Replace',
    'Trim',
    'LTrim',
    'RTrim',
    'UCase',
    'LCase',
    'Split',
    'Join',
    'Chr',
    'Asc'
  ],
  supportedConversionFunctions: ['Val', 'Str', 'CInt', 'CLng', 'CDbl', 'CStr', 'Int', 'Abs'],
  unsupportedFeatures: ['Format', 'With', 'On Error', 'Mid statement', 'line continuation', 'Option Base', 'ADO'],
  coercionMatrix: [
    {
      operatorGroup: 'arithmetic',
      left: 'number',
      right: 'number',
      result: 'number',
      notes: 'Variant 内が number の場合も number として扱う'
    },
    {
      operatorGroup: 'concatenation',
      left: 'scalar',
      right: 'scalar',
      result: 'string',
      notes: '& は任意の scalar を文字列化する'
    },
    {
      operatorGroup: 'comparison',
      left: 'same-scalar',
      right: 'same-scalar',
      result: 'boolean',
      notes: '型が一致する scalar 同士、または Variant 解決後の同種同士のみ許可する'
    }
  ]
};

export const ENGINE_CAPABILITIES: Record<EngineType, EngineCapabilityManifest> = {
  excel: {
    engine: 'excel',
    supportedStatements: ['Sub', 'Function', 'Dim', 'If', 'For', 'For Each', 'Do While', 'Do Until', 'Select Case', 'Debug.Print'],
    supportedFunctions: [...SEMANTICS_PROFILE.supportedStringFunctions, ...SEMANTICS_PROFILE.supportedConversionFunctions],
    supportedObjects: ['Cells', 'Range'],
    unsupportedFeatures: [...SEMANTICS_PROFILE.unsupportedFeatures]
  },
  access: {
    engine: 'access',
    supportedStatements: ['Sub', 'Function', 'Dim', 'If', 'For', 'For Each', 'Do While', 'Do Until', 'Select Case', 'Debug.Print'],
    supportedFunctions: [...SEMANTICS_PROFILE.supportedStringFunctions, ...SEMANTICS_PROFILE.supportedConversionFunctions, 'DLookup', 'DCount', 'DSum'],
    supportedObjects: ['CurrentDb', 'DoCmd', 'Recordset'],
    unsupportedFeatures: [...SEMANTICS_PROFILE.unsupportedFeatures, 'JOIN', 'subquery', 'DDL', 'forms', 'reports']
  }
};

export interface WorkerRequest {
  requestId: string;
  problem: ProblemDefinition;
  source: string;
}

export interface WorkerResponse {
  requestId: string;
  runResult: RunResult;
  judgeResult: JudgeResult;
}
