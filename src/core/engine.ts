import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';
import {
  DEFAULT_EPSILON,
  DEFAULT_LIMITS,
  ENGINE_CAPABILITIES,
  SEMANTICS_PROFILE,
  type Diagnostic,
  type EngineCapabilityManifest,
  type EngineLimits,
  type EngineType,
  type HostSnapshot,
  type JudgeResult,
  type ProblemDefinition,
  type RunResult,
  type SemanticsProfile,
  type SourcePosition,
  type SourceRange,
  type ValidationResult,
  type ValidationSummary
} from './model';

type TokenType = 'identifier' | 'keyword' | 'number' | 'string' | 'operator' | 'punctuation' | 'newline' | 'eof';

interface Token {
  type: TokenType;
  value: string;
  range: SourceRange;
}

interface ModuleNode {
  kind: 'Module';
  procedures: ProcedureNode[];
}

interface ProcedureNode {
  kind: 'Procedure';
  procedureKind: 'sub' | 'function';
  name: string;
  params: ParamNode[];
  body: StatementNode[];
  range: SourceRange;
}

interface ParamNode {
  name: string;
  byRef: boolean;
  typeName?: string;
  range: SourceRange;
}

type StatementNode =
  | DimStatementNode
  | AssignmentStatementNode
  | IfStatementNode
  | ForStatementNode
  | ForEachStatementNode
  | DoStatementNode
  | SelectCaseStatementNode
  | DebugPrintStatementNode
  | ExpressionStatementNode;

interface DimStatementNode {
  kind: 'Dim';
  declarations: Array<{
    name: string;
    typeName?: string;
    arrayUpper?: ExpressionNode;
    range: SourceRange;
  }>;
  range: SourceRange;
}

interface AssignmentStatementNode {
  kind: 'Assignment';
  target: ExpressionNode;
  value: ExpressionNode;
  useSet: boolean;
  range: SourceRange;
}

interface IfStatementNode {
  kind: 'If';
  branches: Array<{
    condition: ExpressionNode;
    body: StatementNode[];
    range: SourceRange;
  }>;
  elseBody?: StatementNode[];
  range: SourceRange;
}

interface ForStatementNode {
  kind: 'For';
  variable: string;
  start: ExpressionNode;
  end: ExpressionNode;
  step?: ExpressionNode;
  body: StatementNode[];
  range: SourceRange;
}

interface ForEachStatementNode {
  kind: 'ForEach';
  variable: string;
  collection: ExpressionNode;
  body: StatementNode[];
  range: SourceRange;
}

interface DoStatementNode {
  kind: 'Do';
  mode: 'while' | 'until';
  check: 'pre' | 'post';
  condition: ExpressionNode;
  body: StatementNode[];
  range: SourceRange;
}

interface SelectCaseStatementNode {
  kind: 'SelectCase';
  expression: ExpressionNode;
  cases: Array<{
    tests: ExpressionNode[] | 'else';
    body: StatementNode[];
    range: SourceRange;
  }>;
  range: SourceRange;
}

interface DebugPrintStatementNode {
  kind: 'DebugPrint';
  expressions: ExpressionNode[];
  range: SourceRange;
}

interface ExpressionStatementNode {
  kind: 'ExpressionStatement';
  expression: ExpressionNode;
  range: SourceRange;
}

type ExpressionNode =
  | LiteralNode
  | IdentifierNode
  | UnaryExpressionNode
  | BinaryExpressionNode
  | CallExpressionNode
  | MemberExpressionNode
  | GroupExpressionNode;

interface LiteralNode {
  kind: 'Literal';
  value: string | number | boolean | null;
  literalType: 'string' | 'number' | 'boolean' | 'null';
  range: SourceRange;
}

interface IdentifierNode {
  kind: 'Identifier';
  name: string;
  range: SourceRange;
}

interface UnaryExpressionNode {
  kind: 'UnaryExpression';
  operator: string;
  argument: ExpressionNode;
  range: SourceRange;
}

interface BinaryExpressionNode {
  kind: 'BinaryExpression';
  operator: string;
  left: ExpressionNode;
  right: ExpressionNode;
  range: SourceRange;
}

interface CallExpressionNode {
  kind: 'CallExpression';
  callee: ExpressionNode;
  args: ExpressionNode[];
  range: SourceRange;
}

interface MemberExpressionNode {
  kind: 'MemberExpression';
  object: ExpressionNode;
  property: string;
  range: SourceRange;
}

interface GroupExpressionNode {
  kind: 'GroupExpression';
  expression: ExpressionNode;
  range: SourceRange;
}

type ScalarValue = number | string | boolean | null;

interface ArrayValue {
  kind: 'array';
  lower: number;
  upper: number;
  items: RuntimeValue[];
}

interface CallableValue {
  kind: 'callable';
  name: string;
  invoke: (args: RuntimeValue[], context: EvaluationContext) => RuntimeValue;
}

interface HostObjectValue {
  kind: 'hostObject';
  typeName: string;
  impl: HostObject;
}

type RuntimeValue = ScalarValue | ArrayValue | CallableValue | HostObjectValue;

interface ValueReference {
  get: () => RuntimeValue;
  set: (value: RuntimeValue) => void;
  range?: SourceRange;
}

interface HostObject {
  readonly typeName: string;
  getMember(name: string, context: EvaluationContext): RuntimeValue;
  setMember?(name: string, value: RuntimeValue, context: EvaluationContext): void;
  callMember?(name: string, args: RuntimeValue[], context: EvaluationContext): RuntimeValue;
  getMemberReference?(name: string, context: EvaluationContext): ValueReference | undefined;
  getCallReference?(name: string, args: RuntimeValue[], context: EvaluationContext): ValueReference | undefined;
  iterate?(context: EvaluationContext): RuntimeValue[];
}

interface EvaluationContext {
  host: VbaHost;
  globals: Map<string, RuntimeValue>;
  procedures: Map<string, ProcedureNode>;
  limits: EngineLimits;
  debugLines: string[];
  stepCount: number;
  startedAt: number;
  currentProcedure?: ProcedureNode;
  diagnostics: Diagnostic[];
}

interface VbaHost {
  readonly engine: EngineType;
  getGlobal(name: string, context: EvaluationContext): RuntimeValue | undefined;
  snapshot(problem: ProblemDefinition): HostSnapshot;
  dispose?(): void;
  prepareJudgeQuery?(sql: string): void;
  readQueryRows?(sql: string): unknown[][];
  dLookup?(fieldName: string, domain: string, criteria?: string): RuntimeValue;
  dCount?(fieldName: string, domain: string, criteria?: string): RuntimeValue;
  dSum?(fieldName: string, domain: string, criteria?: string): RuntimeValue;
}

class ParseError extends Error {
  readonly diagnostic: Diagnostic;

  constructor(message: string, range?: SourceRange, kind: Diagnostic['kind'] = 'Syntax') {
    super(message);
    this.diagnostic = {
      kind,
      severity: 'error',
      message,
      range
    };
  }
}

class RuntimeError extends Error {
  readonly diagnostic: Diagnostic;

  constructor(message: string, range?: SourceRange, kind: Diagnostic['kind'] = 'Runtime') {
    super(message);
    this.diagnostic = {
      kind,
      severity: 'error',
      message,
      range
    };
  }
}

const KEYWORDS = new Set([
  'and',
  'as',
  'byref',
  'byval',
  'case',
  'call',
  'debug',
  'dim',
  'do',
  'each',
  'else',
  'elseif',
  'end',
  'explicit',
  'false',
  'for',
  'function',
  'if',
  'in',
  'loop',
  'mod',
  'next',
  'not',
  'option',
  'or',
  'print',
  'select',
  'set',
  'step',
  'sub',
  'then',
  'to',
  'true',
  'until',
  'while'
]);

const PRECEDENCE: Record<string, number> = {
  or: 1,
  and: 2,
  '=': 4,
  '<>': 4,
  '<': 4,
  '<=': 4,
  '>': 4,
  '>=': 4,
  '&': 5,
  '+': 6,
  '-': 6,
  mod: 7,
  '\\': 8,
  '*': 9,
  '/': 9,
  '^': 10
};

const SUPPORTED_BINARY_OPERATORS = new Set(Object.keys(PRECEDENCE));
const UNARY_PRECEDENCE: Record<string, number> = {
  not: 3
};
const SUPPORTED_UNARY_OPERATORS = new Set(['-', 'not']);
const UNSUPPORTED_TOKENS = ['with', 'on', '_'];

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function clonePosition(position: SourcePosition): SourcePosition {
  return {
    line: position.line,
    column: position.column,
    offset: position.offset
  };
}

function createRange(start: SourcePosition, end: SourcePosition): SourceRange {
  return {
    start: clonePosition(start),
    end: clonePosition(end)
  };
}

function mergeRanges(start: SourceRange, end: SourceRange): SourceRange {
  return {
    start: clonePosition(start.start),
    end: clonePosition(end.end)
  };
}

function isScalar(value: RuntimeValue): value is ScalarValue {
  return value === null || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean';
}

function isCallable(value: RuntimeValue): value is CallableValue {
  return typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'callable';
}

function isHostObjectValue(value: RuntimeValue): value is HostObjectValue {
  return typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'hostObject';
}

function isArrayValue(value: RuntimeValue): value is ArrayValue {
  return typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'array';
}

function asNumber(value: RuntimeValue, range?: SourceRange): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new RuntimeError('数値演算には number が必要なんな', range);
  }
  return value;
}

function asBoolean(value: RuntimeValue, range?: SourceRange): boolean {
  if (typeof value !== 'boolean') {
    throw new RuntimeError('条件式には boolean が必要なんな', range);
  }
  return value;
}

function scalarToString(value: ScalarValue): string {
  if (value === null) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'True' : 'False';
  }
  return String(value);
}

function serializeValue(value: RuntimeValue): unknown {
  if (isArrayValue(value)) {
    return value.items.map((item) => serializeValue(item));
  }
  if (isHostObjectValue(value)) {
    return `[object ${value.typeName}]`;
  }
  if (isCallable(value)) {
    return `[callable ${value.name}]`;
  }
  return value;
}

function normalizeDebugLine(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\s+$/g, '').trim();
}

class Tokenizer {
  private readonly source: string;
  private index = 0;
  private line = 1;
  private column = 1;

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === '\r') {
        this.advance();
        continue;
      }
      if (char === '\n') {
        const start = this.position();
        this.advance();
        tokens.push(this.token('newline', '\n', start, this.position()));
        continue;
      }
      if (char === ':') {
        const start = this.position();
        this.advance();
        tokens.push(this.token('newline', '\n', start, this.position()));
        continue;
      }
      if (char === '\'' || char === '’') {
        this.skipComment();
        continue;
      }
      if (/\s/.test(char)) {
        this.advance();
        continue;
      }
      if (char === '"') {
        tokens.push(this.readString());
        continue;
      }
      if (/[0-9]/.test(char)) {
        tokens.push(this.readNumber());
        continue;
      }
      if (/[A-Za-z_\u0080-\uFFFF]/.test(char)) {
        tokens.push(this.readWord());
        continue;
      }
      if ('(),.'.includes(char)) {
        const start = this.position();
        this.advance();
        tokens.push(this.token('punctuation', char, start, this.position()));
        continue;
      }
      const operator = this.readOperator();
      if (operator) {
        tokens.push(operator);
        continue;
      }
      throw new ParseError(`未対応の文字 ${char} があるんな`, createRange(this.position(), this.position()), 'UnsupportedSyntax');
    }

    const end = this.position();
    tokens.push(this.token('eof', '', end, end));
    return tokens;
  }

  private readOperator(): Token | null {
    const start = this.position();
    const char = this.peek();
    const next = this.peek(1);
    const twoChar = `${char}${next}`;
    if (['<=', '>=', '<>'].includes(twoChar)) {
      this.advance();
      this.advance();
      return this.token('operator', twoChar, start, this.position());
    }
    if ('+-*/\\^&=<>'.includes(char)) {
      this.advance();
      return this.token('operator', char, start, this.position());
    }
    return null;
  }

  private readString(): Token {
    const start = this.position();
    this.advance();
    let value = '';
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === '"') {
        if (this.peek(1) === '"') {
          value += '"';
          this.advance();
          this.advance();
          continue;
        }
        this.advance();
        return this.token('string', value, start, this.position());
      }
      value += char;
      this.advance();
    }
    throw new ParseError('文字列リテラルが閉じていないんな', createRange(start, this.position()));
  }

  private readNumber(): Token {
    const start = this.position();
    let value = '';
    while (!this.isAtEnd() && /[0-9]/.test(this.peek())) {
      value += this.peek();
      this.advance();
    }
    if (!this.isAtEnd() && this.peek() === '.') {
      value += '.';
      this.advance();
      while (!this.isAtEnd() && /[0-9]/.test(this.peek())) {
        value += this.peek();
        this.advance();
      }
    }
    return this.token('number', value, start, this.position());
  }

  private readWord(): Token {
    const start = this.position();
    let value = '';
    while (!this.isAtEnd() && /[A-Za-z0-9_\u0080-\uFFFF]/.test(this.peek())) {
      value += this.peek();
      this.advance();
    }
    const normalized = normalizeName(value);
    if (UNSUPPORTED_TOKENS.includes(normalized)) {
      throw new ParseError(`${value} は v0.1 の対象外なんな`, createRange(start, this.position()), 'UnsupportedSyntax');
    }
    return this.token(KEYWORDS.has(normalized) ? 'keyword' : 'identifier', value, start, this.position());
  }

  private skipComment(): void {
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance();
    }
  }

  private token(type: TokenType, value: string, start: SourcePosition, end: SourcePosition): Token {
    return {
      type,
      value,
      range: createRange(start, end)
    };
  }

  private position(): SourcePosition {
    return {
      line: this.line,
      column: this.column,
      offset: this.index
    };
  }

  private peek(offset = 0): string {
    return this.source[this.index + offset] ?? '';
  }

  private advance(): string {
    const char = this.source[this.index] ?? '';
    this.index += 1;
    if (char === '\n') {
      this.line += 1;
      this.column = 1;
    } else {
      this.column += 1;
    }
    return char;
  }

  private isAtEnd(): boolean {
    return this.index >= this.source.length;
  }
}

class Parser {
  private readonly tokens: Token[];
  private index = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parseModule(): ModuleNode {
    const procedures: ProcedureNode[] = [];
    this.consumeNewlines();
    if (this.matchKeyword('option')) {
      this.expectKeyword('explicit');
      this.consumeNewlines();
    }
    while (!this.check('eof')) {
      procedures.push(this.parseProcedure());
      this.consumeNewlines();
    }
    return {
      kind: 'Module',
      procedures
    };
  }

  private parseProcedure(): ProcedureNode {
    const startToken = this.peek();
    const procedureKind = this.matchKeyword('sub') ? 'sub' : this.matchKeyword('function') ? 'function' : null;
    if (!procedureKind) {
      throw new ParseError('Sub または Function から始めてほしいんな', this.peek().range);
    }
    const nameToken = this.expectIdentifier();
    const params = this.parseProcedureParams();
    this.consumeStatementEnd();
    const body: StatementNode[] = [];
    while (!this.checkKeyword('end') && !this.check('eof')) {
      body.push(this.parseStatement());
      this.consumeNewlines();
    }
    this.expectKeyword('end');
    this.expectKeyword(procedureKind === 'sub' ? 'sub' : 'function');
    const endToken = this.previous();
    return {
      kind: 'Procedure',
      procedureKind,
      name: nameToken.value,
      params,
      body,
      range: mergeRanges(startToken.range, endToken.range)
    };
  }

  private parseProcedureParams(): ParamNode[] {
    const params: ParamNode[] = [];
    if (!this.matchPunctuation('(')) {
      return params;
    }
    if (this.matchPunctuation(')')) {
      return params;
    }
    do {
      const start = this.peek().range;
      const byRef = this.matchKeyword('byval') ? false : this.matchKeyword('byref') ? true : true;
      const name = this.expectIdentifier();
      let typeName: string | undefined;
      if (this.matchKeyword('as')) {
        typeName = this.expectIdentifierOrKeyword().value;
      }
      params.push({
        name: name.value,
        byRef,
        typeName,
        range: mergeRanges(start, this.previous().range)
      });
    } while (this.matchPunctuation(','));
    this.expectPunctuation(')');
    return params;
  }

  private parseStatement(): StatementNode {
    this.consumeNewlines();
    if (this.checkKeyword('dim')) {
      return this.parseDim();
    }
    if (this.checkKeyword('if')) {
      return this.parseIf();
    }
    if (this.checkKeyword('for')) {
      return this.parseFor();
    }
    if (this.checkKeyword('do')) {
      return this.parseDo();
    }
    if (this.checkKeyword('select')) {
      return this.parseSelectCase();
    }
    if (this.checkKeyword('debug')) {
      return this.parseDebugPrint();
    }
    if (this.checkKeyword('set')) {
      return this.parseAssignment(true);
    }
    if (this.checkKeyword('call')) {
      return this.parseCallStatement();
    }
    return this.parseExpressionOrAssignment();
  }

  private parseDim(): DimStatementNode {
    const start = this.expectKeyword('dim');
    const declarations: DimStatementNode['declarations'] = [];
    do {
      const name = this.expectIdentifier();
      let arrayUpper: ExpressionNode | undefined;
      if (this.matchPunctuation('(')) {
        const lower = this.parseExpression();
        if (!this.matchKeyword('to')) {
          throw new ParseError('配列は Dim a(1 To n) 形式だけ対応しているんな', name.range, 'UnsupportedSyntax');
        }
        if (!isLiteralOne(lower)) {
          throw new ParseError('配列の下限は 1 固定なんな', lower.range, 'UnsupportedSyntax');
        }
        arrayUpper = this.parseExpression();
        this.expectPunctuation(')');
      }
      let typeName: string | undefined;
      if (this.matchKeyword('as')) {
        typeName = this.expectIdentifierOrKeyword().value;
      }
      declarations.push({
        name: name.value,
        typeName,
        arrayUpper,
        range: mergeRanges(name.range, this.previous().range)
      });
    } while (this.matchPunctuation(','));
    this.consumeStatementEnd();
    return {
      kind: 'Dim',
      declarations,
      range: mergeRanges(start.range, this.previous().range)
    };
  }

  private parseIf(): IfStatementNode {
    const start = this.expectKeyword('if');
    const branches: IfStatementNode['branches'] = [];
    const firstCondition = this.parseExpression();
    this.expectKeyword('then');
    this.consumeStatementEnd();
    branches.push({
      condition: firstCondition,
      body: this.parseBlockUntil(['elseif', 'else', 'end']),
      range: mergeRanges(start.range, this.previousMeaningful().range)
    });
    while (this.matchKeyword('elseif')) {
      const branchStart = this.previous();
      const condition = this.parseExpression();
      this.expectKeyword('then');
      this.consumeStatementEnd();
      branches.push({
        condition,
        body: this.parseBlockUntil(['elseif', 'else', 'end']),
        range: mergeRanges(branchStart.range, this.previousMeaningful().range)
      });
    }
    let elseBody: StatementNode[] | undefined;
    if (this.matchKeyword('else')) {
      this.consumeStatementEnd();
      elseBody = this.parseBlockUntil(['end']);
    }
    this.expectKeyword('end');
    this.expectKeyword('if');
    const end = this.previous();
    return {
      kind: 'If',
      branches,
      elseBody,
      range: mergeRanges(start.range, end.range)
    };
  }

  private parseFor(): StatementNode {
    const start = this.expectKeyword('for');
    if (this.matchKeyword('each')) {
      const variable = this.expectIdentifier().value;
      this.expectKeyword('in');
      const collection = this.parseExpression();
      this.consumeStatementEnd();
      const body = this.parseBlockUntil(['next']);
      this.expectKeyword('next');
      if (this.check('identifier')) {
        this.advance();
      }
      return {
        kind: 'ForEach',
        variable,
        collection,
        body,
        range: mergeRanges(start.range, this.previous().range)
      };
    }
    const variable = this.expectIdentifier().value;
    this.expectOperator('=');
    const startExpr = this.parseExpression();
    this.expectKeyword('to');
    const endExpr = this.parseExpression();
    let stepExpr: ExpressionNode | undefined;
    if (this.matchKeyword('step')) {
      stepExpr = this.parseExpression();
    }
    this.consumeStatementEnd();
    const body = this.parseBlockUntil(['next']);
    this.expectKeyword('next');
    if (this.check('identifier')) {
      this.advance();
    }
    return {
      kind: 'For',
      variable,
      start: startExpr,
      end: endExpr,
      step: stepExpr,
      body,
      range: mergeRanges(start.range, this.previous().range)
    };
  }

  private parseDo(): DoStatementNode {
    const start = this.expectKeyword('do');
    let mode: 'while' | 'until';
    let check: 'pre' | 'post' = 'pre';
    if (this.matchKeyword('while')) {
      mode = 'while';
    } else if (this.matchKeyword('until')) {
      mode = 'until';
    } else {
      throw new ParseError('Do は While か Until を伴う形だけ対応しているんな', start.range, 'UnsupportedSyntax');
    }
    const condition = this.parseExpression();
    this.consumeStatementEnd();
    const body = this.parseBlockUntil(['loop']);
    this.expectKeyword('loop');
    if (this.matchKeyword('while')) {
      mode = 'while';
      check = 'post';
      this.parseExpression();
      throw new ParseError('Loop While の後判定は v0.1 では未対応なんな', this.previous().range, 'UnsupportedSyntax');
    }
    if (this.matchKeyword('until')) {
      mode = 'until';
      check = 'post';
      this.parseExpression();
      throw new ParseError('Loop Until の後判定は v0.1 では未対応なんな', this.previous().range, 'UnsupportedSyntax');
    }
    return {
      kind: 'Do',
      mode,
      check,
      condition,
      body,
      range: mergeRanges(start.range, this.previous().range)
    };
  }

  private parseSelectCase(): SelectCaseStatementNode {
    const start = this.expectKeyword('select');
    this.expectKeyword('case');
    const expression = this.parseExpression();
    this.consumeStatementEnd();
    const cases: SelectCaseStatementNode['cases'] = [];
    while (!this.checkKeyword('end') && !this.check('eof')) {
      const caseStart = this.expectKeyword('case');
      if (this.matchKeyword('else')) {
        this.consumeStatementEnd();
        cases.push({
          tests: 'else',
          body: this.parseBlockUntil(['case', 'end']),
          range: mergeRanges(caseStart.range, this.previousMeaningful().range)
        });
        continue;
      }
      const tests: ExpressionNode[] = [];
      do {
        tests.push(this.parseExpression());
      } while (this.matchPunctuation(','));
      this.consumeStatementEnd();
      cases.push({
        tests,
        body: this.parseBlockUntil(['case', 'end']),
        range: mergeRanges(caseStart.range, this.previousMeaningful().range)
      });
    }
    this.expectKeyword('end');
    this.expectKeyword('select');
    return {
      kind: 'SelectCase',
      expression,
      cases,
      range: mergeRanges(start.range, this.previous().range)
    };
  }

  private parseDebugPrint(): DebugPrintStatementNode {
    const start = this.expectKeyword('debug');
    this.expectPunctuation('.');
    this.expectKeyword('print');
    const expressions: ExpressionNode[] = [];
    if (!this.check('newline') && !this.check('eof')) {
      do {
        expressions.push(this.parseExpression());
      } while (this.matchPunctuation(','));
    }
    this.consumeStatementEnd();
    return {
      kind: 'DebugPrint',
      expressions,
      range: mergeRanges(start.range, this.previousMeaningful().range)
    };
  }

  private parseAssignment(useSet: boolean): AssignmentStatementNode {
    const start = useSet ? this.expectKeyword('set') : this.peek();
    const target = this.parseReferenceExpression();
    this.expectOperator('=');
    const value = this.parseExpression();
    this.consumeStatementEnd();
    return {
      kind: 'Assignment',
      target,
      value,
      useSet,
      range: mergeRanges(start.range, this.previousMeaningful().range)
    };
  }

  private parseExpressionOrAssignment(): StatementNode {
    const checkpoint = this.index;
    try {
      const target = this.parseReferenceExpression();
      if (this.matchOperator('=')) {
        const value = this.parseExpression();
        this.consumeStatementEnd();
        return {
          kind: 'Assignment',
          target,
          value,
          useSet: false,
          range: mergeRanges(target.range, this.previousMeaningful().range)
        };
      }
    } catch {
      this.index = checkpoint;
    }
    this.index = checkpoint;
    if (this.isBareCallStart()) {
      return this.parseBareCallStatement();
    }
    const expression = this.parseExpression();
    this.consumeStatementEnd();
    return {
      kind: 'ExpressionStatement',
      expression,
      range: expression.range
    };
  }

  private parseCallStatement(): ExpressionStatementNode {
    const start = this.expectKeyword('call');
    const expression = this.parseCallTarget();
    this.consumeStatementEnd();
    return {
      kind: 'ExpressionStatement',
      expression,
      range: mergeRanges(start.range, expression.range)
    };
  }

  private parseBareCallStatement(): ExpressionStatementNode {
    const expression = this.parseCallTarget();
    this.consumeStatementEnd();
    return {
      kind: 'ExpressionStatement',
      expression,
      range: expression.range
    };
  }

  private parseCallTarget(): ExpressionNode {
    const callee = this.parsePrimaryChain();
    if (callee.kind === 'CallExpression') {
      return callee;
    }
    const args: ExpressionNode[] = [];
    if (!this.check('newline') && !this.check('eof')) {
      do {
        args.push(this.parseExpression());
      } while (this.matchPunctuation(','));
    }
    return {
      kind: 'CallExpression',
      callee,
      args,
      range: args.length > 0 ? mergeRanges(callee.range, args[args.length - 1].range) : callee.range
    };
  }

  private isBareCallStart(): boolean {
    if (!this.check('identifier') && !this.check('keyword')) {
      return false;
    }
    let lookaheadIndex = this.index + 1;
    while (
      this.tokens[lookaheadIndex]?.type === 'punctuation' &&
      this.tokens[lookaheadIndex].value === '.' &&
      (this.tokens[lookaheadIndex + 1]?.type === 'identifier' || this.tokens[lookaheadIndex + 1]?.type === 'keyword')
    ) {
      lookaheadIndex += 2;
    }
    const next = this.tokens[lookaheadIndex];
    if (!next || next.type === 'newline' || next.type === 'eof' || (next.type === 'punctuation' && next.value === '(')) {
      return false;
    }
    return next.type === 'identifier' || next.type === 'keyword' || next.type === 'number' || next.type === 'string' || (next.type === 'punctuation' && next.value === '(');
  }

  private parseReferenceExpression(): ExpressionNode {
    const expression = this.parsePrimaryChain();
    if (!isAssignableExpression(expression)) {
      throw new ParseError('代入先にできない式なんな', expression.range);
    }
    return expression;
  }

  private parseExpression(precedence = 0): ExpressionNode {
    let left = this.parsePrefix(precedence);
    while (true) {
      const operatorToken = this.peek();
      const operator = normalizeName(operatorToken.value);
      if (
        (operatorToken.type !== 'operator' && operatorToken.type !== 'keyword') ||
        !SUPPORTED_BINARY_OPERATORS.has(operator) ||
        PRECEDENCE[operator] <= precedence
      ) {
        break;
      }
      this.advance();
      const right = this.parseExpression(PRECEDENCE[operator]);
      left = {
        kind: 'BinaryExpression',
        operator,
        left,
        right,
        range: mergeRanges(left.range, right.range)
      };
    }
    return left;
  }

  private parsePrefix(precedence: number): ExpressionNode {
    if (this.peek().type === 'keyword') {
      const operator = normalizeName(this.peek().value);
      const operatorPrecedence = UNARY_PRECEDENCE[operator];
      if (operatorPrecedence !== undefined && operatorPrecedence > precedence) {
        const token = this.advance();
        const argument = this.parseExpression(operatorPrecedence);
        return {
          kind: 'UnaryExpression',
          operator,
          argument,
          range: mergeRanges(token.range, argument.range)
        };
      }
    }
    return this.parseUnary();
  }

  private parseUnary(): ExpressionNode {
    if (this.peek().type === 'operator' || this.peek().type === 'keyword') {
      const operator = normalizeName(this.peek().value);
      if (SUPPORTED_UNARY_OPERATORS.has(operator) && UNARY_PRECEDENCE[operator] === undefined) {
        const token = this.advance();
        const argument = this.parseUnary();
        return {
          kind: 'UnaryExpression',
          operator,
          argument,
          range: mergeRanges(token.range, argument.range)
        };
      }
    }
    return this.parsePrimaryChain();
  }

  private parsePrimaryChain(): ExpressionNode {
    let expression = this.parsePrimary();
    while (true) {
      if (this.matchPunctuation('.')) {
        const property = this.expectIdentifierOrKeyword();
        expression = {
          kind: 'MemberExpression',
          object: expression,
          property: property.value,
          range: mergeRanges(expression.range, property.range)
        };
        continue;
      }
      if (this.matchPunctuation('(')) {
        const args: ExpressionNode[] = [];
        if (!this.checkPunctuation(')')) {
          do {
            args.push(this.parseExpression());
          } while (this.matchPunctuation(','));
        }
        const close = this.expectPunctuation(')');
        expression = {
          kind: 'CallExpression',
          callee: expression,
          args,
          range: mergeRanges(expression.range, close.range)
        };
        continue;
      }
      break;
    }
    return expression;
  }

  private parsePrimary(): ExpressionNode {
    const token = this.peek();
    if (this.matchPunctuation('(')) {
      const expression = this.parseExpression();
      const end = this.expectPunctuation(')');
      return {
        kind: 'GroupExpression',
        expression,
        range: mergeRanges(token.range, end.range)
      };
    }
    if (this.match('number')) {
      return {
        kind: 'Literal',
        value: Number(token.value),
        literalType: 'number',
        range: token.range
      };
    }
    if (this.match('string')) {
      return {
        kind: 'Literal',
        value: token.value,
        literalType: 'string',
        range: token.range
      };
    }
    if (this.matchKeyword('true')) {
      return {
        kind: 'Literal',
        value: true,
        literalType: 'boolean',
        range: token.range
      };
    }
    if (this.matchKeyword('false')) {
      return {
        kind: 'Literal',
        value: false,
        literalType: 'boolean',
        range: token.range
      };
    }
    if (token.type === 'identifier' || token.type === 'keyword') {
      this.advance();
      return {
        kind: 'Identifier',
        name: token.value,
        range: token.range
      };
    }
    throw new ParseError('式を解釈できなかったんな', token.range);
  }

  private parseBlockUntil(stopWords: string[]): StatementNode[] {
    const statements: StatementNode[] = [];
    this.consumeNewlines();
    while (!this.check('eof')) {
      const current = normalizeName(this.peek().value);
      if (this.peek().type === 'keyword' && stopWords.includes(current)) {
        break;
      }
      statements.push(this.parseStatement());
      this.consumeNewlines();
    }
    return statements;
  }

  private consumeStatementEnd(): void {
    if (this.check('newline') || this.check('eof')) {
      this.consumeNewlines();
      return;
    }
    throw new ParseError('文の終わりが必要なんな', this.peek().range);
  }

  private consumeNewlines(): void {
    while (this.match('newline')) {
      // noop
    }
  }

  private expectIdentifier(): Token {
    if (this.check('identifier')) {
      return this.advance();
    }
    throw new ParseError('識別子が必要なんな', this.peek().range);
  }

  private expectIdentifierOrKeyword(): Token {
    if (this.check('identifier') || this.check('keyword')) {
      return this.advance();
    }
    throw new ParseError('名前が必要なんな', this.peek().range);
  }

  private expectKeyword(value: string): Token {
    if (this.checkKeyword(value)) {
      return this.advance();
    }
    throw new ParseError(`${value} が必要なんな`, this.peek().range);
  }

  private expectOperator(value: string): Token {
    if (this.checkOperator(value)) {
      return this.advance();
    }
    throw new ParseError(`${value} が必要なんな`, this.peek().range);
  }

  private expectPunctuation(value: string): Token {
    if (this.checkPunctuation(value)) {
      return this.advance();
    }
    throw new ParseError(`${value} が必要なんな`, this.peek().range);
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private checkKeyword(value: string): boolean {
    return this.peek().type === 'keyword' && normalizeName(this.peek().value) === normalizeName(value);
  }

  private checkOperator(value: string): boolean {
    return this.peek().type === 'operator' && this.peek().value === value;
  }

  private checkPunctuation(value: string): boolean {
    return this.peek().type === 'punctuation' && this.peek().value === value;
  }

  private match(type: TokenType): boolean {
    if (!this.check(type)) {
      return false;
    }
    this.advance();
    return true;
  }

  private matchKeyword(value: string): boolean {
    if (!this.checkKeyword(value)) {
      return false;
    }
    this.advance();
    return true;
  }

  private matchOperator(value: string): boolean {
    if (!this.checkOperator(value)) {
      return false;
    }
    this.advance();
    return true;
  }

  private matchPunctuation(value: string): boolean {
    if (!this.checkPunctuation(value)) {
      return false;
    }
    this.advance();
    return true;
  }

  private previous(): Token {
    return this.tokens[this.index - 1];
  }

  private previousMeaningful(): Token {
    for (let i = this.index - 1; i >= 0; i -= 1) {
      if (this.tokens[i].type !== 'newline') {
        return this.tokens[i];
      }
    }
    return this.tokens[0];
  }

  private advance(): Token {
    const token = this.tokens[this.index];
    this.index += 1;
    return token;
  }

  private peek(): Token {
    return this.tokens[this.index];
  }
}

function isLiteralOne(expression: ExpressionNode): boolean {
  return expression.kind === 'Literal' && expression.literalType === 'number' && expression.value === 1;
}

function isAssignableExpression(expression: ExpressionNode): boolean {
  return expression.kind === 'Identifier' || expression.kind === 'MemberExpression' || expression.kind === 'CallExpression';
}

class Environment {
  private readonly values = new Map<string, ValueReference>();
  private readonly parent?: Environment;

  constructor(parent?: Environment) {
    this.parent = parent;
  }

  declare(name: string, initial: RuntimeValue): ValueReference {
    const normalized = normalizeName(name);
    const state = { current: initial };
    const ref: ValueReference = {
      get: () => state.current,
      set: (value: RuntimeValue) => {
        state.current = value;
      }
    };
    this.values.set(normalized, ref);
    return ref;
  }

  bindReference(name: string, reference: ValueReference): void {
    this.values.set(normalizeName(name), reference);
  }

  lookup(name: string): ValueReference | undefined {
    const normalized = normalizeName(name);
    if (this.values.has(normalized)) {
      return this.values.get(normalized);
    }
    return this.parent?.lookup(normalized);
  }
}

function createCallable(name: string, invoke: CallableValue['invoke']): CallableValue {
  return {
    kind: 'callable',
    name,
    invoke
  };
}

function createHostObject(impl: HostObject): HostObjectValue {
  return {
    kind: 'hostObject',
    typeName: impl.typeName,
    impl
  };
}

function assertHostObject(value: RuntimeValue, range?: SourceRange): HostObjectValue {
  if (!isHostObjectValue(value)) {
    throw new RuntimeError('オブジェクトが必要なんな', range);
  }
  return value;
}

class Interpreter {
  private readonly module: ModuleNode;
  private readonly context: EvaluationContext;
  private readonly procedures = new Map<string, ProcedureNode>();

  constructor(module: ModuleNode, host: VbaHost, limits: EngineLimits) {
    this.module = module;
    for (const procedure of module.procedures) {
      this.procedures.set(normalizeName(procedure.name), procedure);
    }
    this.context = {
      host,
      globals: new Map(),
      procedures: this.procedures,
      limits,
      debugLines: [],
      stepCount: 0,
      startedAt: Date.now(),
      diagnostics: []
    };
    this.installGlobals();
  }

  execute(problem: ProblemDefinition): RunResult {
    const startedAt = Date.now();
    try {
      const procedure = this.procedures.get(normalizeName(problem.entryPoint));
      if (!procedure) {
        throw new RuntimeError(`entryPoint ${problem.entryPoint} が見つからないんな`);
      }
      const args = problem.args.map((arg) => ({
        value: toRuntimeValue(arg)
      }));
      const value = this.invokeProcedure(procedure, args);
      if (problem.judge.type === 'query' && this.context.host.prepareJudgeQuery) {
        this.context.host.prepareJudgeQuery(problem.judge.sql);
      }
      return {
        ok: true,
        diagnostics: [],
        debugLines: [...this.context.debugLines],
        returnValue: serializeValue(value),
        snapshot: this.context.host.snapshot(problem),
        durationMs: Date.now() - startedAt
      };
    } catch (error) {
      const diagnostic = error instanceof RuntimeError || error instanceof ParseError
        ? error.diagnostic
        : {
            kind: 'Runtime' as const,
            severity: 'error' as const,
            message: error instanceof Error ? error.message : '不明な実行エラーなんな'
          };
      return {
        ok: false,
        diagnostics: [diagnostic],
        debugLines: [...this.context.debugLines],
        snapshot: this.context.host.snapshot(problem),
        durationMs: Date.now() - startedAt
      };
    }
  }

  private installGlobals(): void {
    for (const builtin of createBuiltins()) {
      this.context.globals.set(normalizeName(builtin.name), builtin.value);
    }
  }

  private invokeProcedure(
    procedure: ProcedureNode,
    args: Array<{
      value: RuntimeValue;
      reference?: ValueReference;
    }>
  ): RuntimeValue {
    const environment = new Environment();
    environment.declare(procedure.name, null);

    procedure.params.forEach((param, index) => {
      const arg = args[index] ?? { value: null };
      if (param.byRef && arg.reference) {
        environment.bindReference(param.name, arg.reference);
        return;
      }
      environment.declare(param.name, cloneRuntimeValue(arg.value));
    });

    const previousProcedure = this.context.currentProcedure;
    this.context.currentProcedure = procedure;
    try {
      this.executeStatements(procedure.body, environment);
      return environment.lookup(procedure.name)?.get() ?? null;
    } finally {
      this.context.currentProcedure = previousProcedure;
    }
  }

  private executeStatements(statements: StatementNode[], environment: Environment): void {
    for (const statement of statements) {
      this.bumpStep(statement.range);
      this.executeStatement(statement, environment);
    }
  }

  private executeStatement(statement: StatementNode, environment: Environment): void {
    switch (statement.kind) {
      case 'Dim':
        for (const declaration of statement.declarations) {
          const initial = declaration.arrayUpper
            ? this.createArrayValue(
                this.evaluateExpression(declaration.arrayUpper, environment),
                declaration.typeName,
                declaration.range
              )
            : defaultValueForType(declaration.typeName);
          environment.declare(declaration.name, initial);
        }
        return;
      case 'Assignment': {
        const targetRef = this.evaluateReference(statement.target, environment);
        const value = this.evaluateExpression(statement.value, environment);
        if (statement.useSet && !isHostObjectValue(value)) {
          throw new RuntimeError('Set ではオブジェクト代入が必要なんな', statement.range);
        }
        if (!statement.useSet && isHostObjectValue(value)) {
          throw new RuntimeError('オブジェクト代入には Set が必要なんな', statement.range);
        }
        targetRef.set(cloneRuntimeValue(value));
        return;
      }
      case 'If': {
        for (const branch of statement.branches) {
          if (asBoolean(this.evaluateExpression(branch.condition, environment), branch.condition.range)) {
            this.executeStatements(branch.body, new Environment(environment));
            return;
          }
        }
        if (statement.elseBody) {
          this.executeStatements(statement.elseBody, new Environment(environment));
        }
        return;
      }
      case 'For': {
        const variableRef = environment.lookup(statement.variable);
        if (!variableRef) {
          throw new RuntimeError(`未宣言変数 ${statement.variable} が使われているんな`, statement.range);
        }
        const start = asNumber(this.evaluateExpression(statement.start, environment), statement.start.range);
        const end = asNumber(this.evaluateExpression(statement.end, environment), statement.end.range);
        const step = statement.step ? asNumber(this.evaluateExpression(statement.step, environment), statement.step.range) : 1;
        if (step === 0) {
          throw new RuntimeError('For の Step に 0 は指定できないんな', statement.step?.range ?? statement.range);
        }
        for (let i = start; step >= 0 ? i <= end : i >= end; i += step) {
          variableRef.set(i);
          this.executeStatements(statement.body, new Environment(environment));
          this.bumpStep(statement.range);
        }
        return;
      }
      case 'ForEach': {
        const variableRef = environment.lookup(statement.variable);
        if (!variableRef) {
          throw new RuntimeError(`未宣言変数 ${statement.variable} が使われているんな`, statement.range);
        }
        const collection = this.evaluateExpression(statement.collection, environment);
        const items = this.toIterable(collection, statement.collection.range);
        for (const item of items) {
          variableRef.set(cloneRuntimeValue(item));
          this.executeStatements(statement.body, new Environment(environment));
          this.bumpStep(statement.range);
        }
        return;
      }
      case 'Do': {
        while (true) {
          const condition = asBoolean(this.evaluateExpression(statement.condition, environment), statement.condition.range);
          const shouldContinue = statement.mode === 'while' ? condition : !condition;
          if (!shouldContinue) {
            break;
          }
          this.executeStatements(statement.body, new Environment(environment));
          this.bumpStep(statement.range);
        }
        return;
      }
      case 'SelectCase': {
        const value = this.evaluateExpression(statement.expression, environment);
        for (const selectCase of statement.cases) {
          if (selectCase.tests === 'else') {
            this.executeStatements(selectCase.body, new Environment(environment));
            return;
          }
          for (const test of selectCase.tests) {
            const testValue = this.evaluateExpression(test, environment);
            if (compareValues(value, testValue, '=')) {
              this.executeStatements(selectCase.body, new Environment(environment));
              return;
            }
          }
        }
        return;
      }
      case 'DebugPrint': {
        const line = statement.expressions.map((expression) => scalarToString(asScalar(this.evaluateExpression(expression, environment), expression.range))).join(' ');
        this.context.debugLines.push(line);
        return;
      }
      case 'ExpressionStatement': {
        const value = this.evaluateExpression(statement.expression, environment);
        if (isCallable(value)) {
          value.invoke([], this.context);
        }
      }
    }
  }

  private evaluateExpression(expression: ExpressionNode, environment: Environment): RuntimeValue {
    switch (expression.kind) {
      case 'Literal':
        return expression.value;
      case 'Identifier': {
        const local = environment.lookup(expression.name);
        if (local) {
          return local.get();
        }
        const procedure = this.procedures.get(normalizeName(expression.name));
        if (procedure) {
          return this.invokeProcedure(procedure, []);
        }
        const global = this.context.globals.get(normalizeName(expression.name)) ?? this.context.host.getGlobal(expression.name, this.context);
        if (global !== undefined) {
          return global;
        }
        throw new RuntimeError(`未宣言変数 ${expression.name} が使われているんな`, expression.range);
      }
      case 'GroupExpression':
        return this.evaluateExpression(expression.expression, environment);
      case 'UnaryExpression': {
        const value = this.evaluateExpression(expression.argument, environment);
        if (expression.operator === '-') {
          return -asNumber(value, expression.range);
        }
        if (expression.operator === 'not') {
          return !asBoolean(value, expression.range);
        }
        throw new RuntimeError(`未対応の単項演算子 ${expression.operator} なんな`, expression.range, 'UnsupportedSyntax');
      }
      case 'BinaryExpression': {
        const left = this.evaluateExpression(expression.left, environment);
        const right = this.evaluateExpression(expression.right, environment);
        return evaluateBinary(expression.operator, left, right, expression.range);
      }
      case 'MemberExpression': {
        const objectValue = assertHostObject(this.evaluateExpression(expression.object, environment), expression.object.range);
        return objectValue.impl.getMember(expression.property, this.context);
      }
      case 'CallExpression':
        return this.evaluateCall(expression, environment);
    }
  }

  private evaluateCall(expression: CallExpressionNode, environment: Environment): RuntimeValue {
    if (expression.callee.kind === 'Identifier') {
      const procedure = this.procedures.get(normalizeName(expression.callee.name));
      if (procedure) {
        const args = expression.args.map((arg, index) => {
          const parameter = procedure.params[index];
          const value = this.evaluateExpression(arg, environment);
          let reference: ValueReference | undefined;
          if (parameter?.byRef) {
            try {
              reference = this.evaluateReference(arg, environment);
            } catch {
              reference = undefined;
            }
          }
          return { value, reference };
        });
        return this.invokeProcedure(procedure, args);
      }
    }

    const args = expression.args.map((arg) => this.evaluateExpression(arg, environment));
    if (expression.callee.kind === 'Identifier') {
      const local = environment.lookup(expression.callee.name);
      if (local) {
        const value = local.get();
        if (isArrayValue(value)) {
          return this.readArrayIndex(value, args, expression.range);
        }
      }
    }
    if (expression.callee.kind === 'MemberExpression') {
      const object = assertHostObject(this.evaluateExpression(expression.callee.object, environment), expression.callee.object.range);
      if (object.impl.callMember) {
        return object.impl.callMember(expression.callee.property, args, this.context);
      }
    }
    const callee = this.evaluateExpression(expression.callee, environment);
    if (isCallable(callee)) {
      return callee.invoke(args, this.context);
    }
    if (isArrayValue(callee)) {
      return this.readArrayIndex(callee, args, expression.range);
    }
    throw new RuntimeError('呼び出せない対象が関数のように使われているんな', expression.range);
  }

  private readArrayIndex(arrayValue: ArrayValue, args: RuntimeValue[], range: SourceRange): RuntimeValue {
    if (args.length !== 1) {
      throw new RuntimeError('配列アクセスは 1 次元だけ対応しているんな', range);
    }
    const index = asNumber(args[0], range);
    const offset = index - arrayValue.lower;
    if (!Number.isInteger(index) || offset < 0 || offset >= arrayValue.items.length) {
      throw new RuntimeError('配列添字が範囲外なんな', range);
    }
    return arrayValue.items[offset];
  }

  private evaluateReference(expression: ExpressionNode, environment: Environment): ValueReference {
    switch (expression.kind) {
      case 'Identifier': {
        const ref = environment.lookup(expression.name);
        if (!ref) {
          throw new RuntimeError(`未宣言変数 ${expression.name} が使われているんな`, expression.range);
        }
        return ref;
      }
      case 'MemberExpression': {
        const object = assertHostObject(this.evaluateExpression(expression.object, environment), expression.object.range);
        const ref = object.impl.getMemberReference?.(expression.property, this.context);
        if (!ref) {
          throw new RuntimeError(`${expression.property} は代入できないんな`, expression.range);
        }
        return ref;
      }
      case 'CallExpression': {
        if (expression.callee.kind === 'Identifier') {
          const ref = environment.lookup(expression.callee.name);
          if (ref && isArrayValue(ref.get())) {
            const arrayValue = ref.get() as ArrayValue;
            const args = expression.args.map((arg) => this.evaluateExpression(arg, environment));
            const index = asNumber(args[0], expression.range);
            const offset = index - arrayValue.lower;
            if (!Number.isInteger(index) || offset < 0 || offset >= arrayValue.items.length) {
              throw new RuntimeError('配列添字が範囲外なんな', expression.range);
            }
            return {
              get: () => arrayValue.items[offset],
              set: (value: RuntimeValue) => {
                arrayValue.items[offset] = value;
              }
            };
          }
        }
        if (expression.callee.kind === 'MemberExpression') {
          const object = assertHostObject(this.evaluateExpression(expression.callee.object, environment), expression.callee.object.range);
          const args = expression.args.map((arg) => this.evaluateExpression(arg, environment));
          const ref = object.impl.getCallReference?.(expression.callee.property, args, this.context);
          if (ref) {
            return ref;
          }
        }
        throw new RuntimeError('代入可能な参照として扱えないんな', expression.range);
      }
      default:
        throw new RuntimeError('代入先が不正なんな', expression.range);
    }
  }

  private createArrayValue(upperValue: RuntimeValue, typeName: string | undefined, range: SourceRange): ArrayValue {
    const upper = asNumber(upperValue, range);
    if (!Number.isInteger(upper) || upper < 1) {
      throw new RuntimeError('配列上限は 1 以上の整数が必要なんな', range);
    }
    if (upper > this.context.limits.maxArrayElements) {
      throw new RuntimeError('配列サイズが大きすぎるんな', range, 'MemoryLimit');
    }
    return {
      kind: 'array',
      lower: 1,
      upper,
      items: Array.from({ length: upper }, () => cloneRuntimeValue(defaultValueForType(typeName)))
    };
  }

  private toIterable(value: RuntimeValue, range: SourceRange): RuntimeValue[] {
    if (isArrayValue(value)) {
      return [...value.items];
    }
    if (isHostObjectValue(value) && value.impl.iterate) {
      return value.impl.iterate(this.context);
    }
    throw new RuntimeError('For Each の対象にできないんな', range);
  }

  private bumpStep(range?: SourceRange): void {
    this.context.stepCount += 1;
    if (this.context.stepCount > this.context.limits.maxSteps) {
      throw new RuntimeError('実行ステップ上限を超えたんな', range, 'StepLimit');
    }
    if (Date.now() - this.context.startedAt > this.context.limits.timeoutMs) {
      throw new RuntimeError('実行がタイムアウトしたんな', range, 'Timeout');
    }
  }
}

function asScalar(value: RuntimeValue, range?: SourceRange): ScalarValue {
  if (!isScalar(value)) {
    throw new RuntimeError('scalar 値が必要なんな', range);
  }
  return value;
}

function evaluateBinary(operator: string, left: RuntimeValue, right: RuntimeValue, range: SourceRange): RuntimeValue {
  if (operator === '&') {
    return scalarToString(asScalar(left, range)) + scalarToString(asScalar(right, range));
  }
  if (['+', '-', '*', '/', '\\', 'mod', '^'].includes(operator)) {
    const leftNumber = asNumber(left, range);
    const rightNumber = asNumber(right, range);
    switch (operator) {
      case '+':
        return leftNumber + rightNumber;
      case '-':
        return leftNumber - rightNumber;
      case '*':
        return leftNumber * rightNumber;
      case '/':
        if (rightNumber === 0) {
          throw new RuntimeError('0 で割ることはできないんな', range);
        }
        return leftNumber / rightNumber;
      case '\\':
        if (rightNumber === 0) {
          throw new RuntimeError('0 で割ることはできないんな', range);
        }
        return Math.trunc(leftNumber / rightNumber);
      case 'mod':
        if (rightNumber === 0) {
          throw new RuntimeError('0 で割ることはできないんな', range);
        }
        return leftNumber % rightNumber;
      case '^':
        return leftNumber ** rightNumber;
      default:
        return null;
    }
  }
  if (['=', '<>', '<', '<=', '>', '>='].includes(operator)) {
    return compareValues(left, right, operator, range);
  }
  if (operator === 'and') {
    return asBoolean(left, range) && asBoolean(right, range);
  }
  if (operator === 'or') {
    return asBoolean(left, range) || asBoolean(right, range);
  }
  throw new RuntimeError(`未対応の演算子 ${operator} なんな`, range, 'UnsupportedSyntax');
}

function compareValues(left: RuntimeValue, right: RuntimeValue, operator: string, range?: SourceRange): boolean {
  if (!isScalar(left) || !isScalar(right)) {
    throw new RuntimeError('比較は scalar 同士だけ対応しているんな', range);
  }
  if (left === null || right === null) {
    if (operator === '=') {
      return left === right;
    }
    if (operator === '<>') {
      return left !== right;
    }
    throw new RuntimeError('null を含む大小比較はできないんな', range);
  }
  if (typeof left !== typeof right) {
    throw new RuntimeError('異なる型同士の比較は v0.1 ではできないんな', range);
  }
  switch (operator) {
    case '=':
      return left === right;
    case '<>':
      return left !== right;
    case '<':
      return (left as number | string) < (right as number | string);
    case '<=':
      return (left as number | string) <= (right as number | string);
    case '>':
      return (left as number | string) > (right as number | string);
    case '>=':
      return (left as number | string) >= (right as number | string);
    default:
      throw new RuntimeError(`比較演算子 ${operator} は未対応なんな`, range, 'UnsupportedSyntax');
  }
}

function cloneRuntimeValue(value: RuntimeValue): RuntimeValue {
  if (isArrayValue(value)) {
    return {
      kind: 'array',
      lower: value.lower,
      upper: value.upper,
      items: value.items.map((item) => cloneRuntimeValue(item))
    };
  }
  return value;
}

function toRuntimeValue(value: unknown): RuntimeValue {
  if (value === null || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return value as ScalarValue;
  }
  if (Array.isArray(value)) {
    return {
      kind: 'array',
      lower: 1,
      upper: value.length,
      items: value.map((item) => toRuntimeValue(item))
    };
  }
  return String(value);
}

function createBuiltins(): Array<{ name: string; value: RuntimeValue }> {
  const builtins: Array<{ name: string; value: RuntimeValue }> = [];
  const add = (name: string, fn: (args: RuntimeValue[], context: EvaluationContext) => RuntimeValue) => {
    builtins.push({ name, value: createCallable(name, fn) });
  };

  add('Len', ([value]) => scalarToString(asScalar(value)).length);
  add('Left', ([value, count]) => scalarToString(asScalar(value)).slice(0, asNumber(count)));
  add('Right', ([value, count]) => {
    const text = scalarToString(asScalar(value));
    return text.slice(text.length - asNumber(count));
  });
  add('Mid', ([value, start, length]) => {
    const text = scalarToString(asScalar(value));
    const offset = asNumber(start) - 1;
    if (length === undefined) {
      return text.slice(offset);
    }
    return text.slice(offset, offset + asNumber(length));
  });
  add('InStr', ([haystack, needle]) => {
    const index = scalarToString(asScalar(haystack)).indexOf(scalarToString(asScalar(needle)));
    return index >= 0 ? index + 1 : 0;
  });
  add('Replace', ([target, find, replace]) =>
    scalarToString(asScalar(target)).split(scalarToString(asScalar(find))).join(scalarToString(asScalar(replace)))
  );
  add('Trim', ([value]) => scalarToString(asScalar(value)).trim());
  add('LTrim', ([value]) => scalarToString(asScalar(value)).replace(/^\s+/g, ''));
  add('RTrim', ([value]) => scalarToString(asScalar(value)).replace(/\s+$/g, ''));
  add('UCase', ([value]) => scalarToString(asScalar(value)).toUpperCase());
  add('LCase', ([value]) => scalarToString(asScalar(value)).toLowerCase());
  add('Split', ([value, delimiter]) => {
    const items = scalarToString(asScalar(value)).split(scalarToString(asScalar(delimiter)));
    return {
      kind: 'array',
      lower: 1,
      upper: items.length,
      items
    };
  });
  add('Join', ([value, delimiter]) => {
    if (!isArrayValue(value)) {
      throw new RuntimeError('Join の第1引数は配列が必要なんな');
    }
    return value.items.map((item) => scalarToString(asScalar(item))).join(scalarToString(asScalar(delimiter ?? ' ')));
  });
  add('Chr', ([value]) => String.fromCharCode(asNumber(value)));
  add('Asc', ([value]) => scalarToString(asScalar(value)).charCodeAt(0));
  add('Val', ([value]) => Number.parseFloat(scalarToString(asScalar(value))) || 0);
  add('Str', ([value]) => scalarToString(asScalar(value)));
  add('CInt', ([value]) => Math.trunc(asNumber(value)));
  add('CLng', ([value]) => Math.trunc(asNumber(value)));
  add('CDbl', ([value]) => asNumber(value));
  add('CStr', ([value]) => scalarToString(asScalar(value)));
  add('Int', ([value]) => Math.floor(asNumber(value)));
  add('Abs', ([value]) => Math.abs(asNumber(value)));
  add('DLookup', ([field, domain, criteria], context) => {
    if (!context.host.dLookup) {
      throw new RuntimeError('DLookup は Access モードだけ対応なんな');
    }
    return context.host.dLookup(
      scalarToString(asScalar(field)),
      scalarToString(asScalar(domain)),
      criteria === undefined ? undefined : scalarToString(asScalar(criteria))
    );
  });
  add('DCount', ([field, domain, criteria], context) => {
    if (!context.host.dCount) {
      throw new RuntimeError('DCount は Access モードだけ対応なんな');
    }
    return context.host.dCount(
      scalarToString(asScalar(field)),
      scalarToString(asScalar(domain)),
      criteria === undefined ? undefined : scalarToString(asScalar(criteria))
    );
  });
  add('DSum', ([field, domain, criteria], context) => {
    if (!context.host.dSum) {
      throw new RuntimeError('DSum は Access モードだけ対応なんな');
    }
    return context.host.dSum(
      scalarToString(asScalar(field)),
      scalarToString(asScalar(domain)),
      criteria === undefined ? undefined : scalarToString(asScalar(criteria))
    );
  });
  return builtins;
}

function defaultValueForType(typeName?: string): RuntimeValue {
  const normalized = normalizeName(typeName ?? 'variant');
  if (normalized === 'integer' || normalized === 'long' || normalized === 'double') {
    return 0;
  }
  if (normalized === 'string') {
    return '';
  }
  if (normalized === 'boolean') {
    return false;
  }
  return null;
}

function columnToIndex(columnName: string): number {
  return columnName.toUpperCase().split('').reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0);
}

function indexToColumn(index: number): string {
  let value = index;
  let output = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    value = Math.floor((value - 1) / 26);
  }
  return output;
}

function parseCellAddress(address: string): { row: number; column: number } {
  const match = address.trim().match(/^([A-Za-z]+)(\d+)$/);
  if (!match) {
    throw new RuntimeError(`セル番地 ${address} を解釈できないんな`);
  }
  return {
    column: columnToIndex(match[1]),
    row: Number(match[2])
  };
}

function formatCellAddress(row: number, column: number): string {
  return `${indexToColumn(column)}${row}`;
}

class ExcelCellObject implements HostObject {
  readonly typeName = 'ExcelCell';
  private readonly host: ExcelHost;
  private readonly row: number;
  private readonly column: number;

  constructor(host: ExcelHost, row: number, column: number) {
    this.host = host;
    this.row = row;
    this.column = column;
  }

  getMember(name: string, _context: EvaluationContext): RuntimeValue {
    if (normalizeName(name) === 'value') {
      return this.host.readCell(this.row, this.column);
    }
    throw new RuntimeError(`ExcelCell.${name} は未対応なんな`);
  }

  setMember(name: string, value: RuntimeValue, _context: EvaluationContext): void {
    if (normalizeName(name) === 'value') {
      this.host.writeCell(this.row, this.column, asScalar(value));
      return;
    }
    throw new RuntimeError(`ExcelCell.${name} は未対応なんな`);
  }

  getMemberReference(name: string, _context: EvaluationContext): ValueReference | undefined {
    if (normalizeName(name) !== 'value') {
      return undefined;
    }
    return {
      get: () => this.host.readCell(this.row, this.column),
      set: (value: RuntimeValue) => {
        this.host.writeCell(this.row, this.column, asScalar(value));
      }
    };
  }
}

class ExcelRangeObject implements HostObject {
  readonly typeName = 'ExcelRange';
  private readonly cells: ExcelCellObject[];

  constructor(cells: ExcelCellObject[]) {
    this.cells = cells;
  }

  getMember(name: string, context: EvaluationContext): RuntimeValue {
    if (normalizeName(name) === 'value') {
      if (this.cells.length !== 1) {
        throw new RuntimeError('複数セル Range の Value 読み取りは v0.1 では単一セルだけ対応なんな');
      }
      return this.cells[0].getMember('Value', context);
    }
    throw new RuntimeError(`Range.${name} は未対応なんな`);
  }

  setMember(name: string, value: RuntimeValue, context: EvaluationContext): void {
    if (normalizeName(name) === 'value') {
      for (const cell of this.cells) {
        cell.setMember?.('Value', value, context);
      }
      return;
    }
    throw new RuntimeError(`Range.${name} は未対応なんな`);
  }

  getMemberReference(name: string, context: EvaluationContext): ValueReference | undefined {
    if (normalizeName(name) !== 'value' || this.cells.length !== 1) {
      return undefined;
    }
    return this.cells[0].getMemberReference?.('Value', context);
  }

  iterate(_context: EvaluationContext): RuntimeValue[] {
    return this.cells.map((cell) => createHostObject(cell));
  }
}

class ExcelHost implements VbaHost {
  readonly engine: EngineType = 'excel';
  private readonly sheet = new Map<string, ScalarValue>();
  private readonly limits: EngineLimits;

  constructor(initialSheet: ProblemDefinition['initialSheet'], limits: EngineLimits) {
    this.limits = limits;
    if (initialSheet) {
      const entries = Object.entries(initialSheet);
      if (entries.length > limits.maxCells) {
        throw new RuntimeError('初期シートのセル数が多すぎるんな', undefined, 'MemoryLimit');
      }
      for (const [address, value] of entries) {
        this.sheet.set(address.toUpperCase(), toScalar(value));
      }
    }
  }

  getGlobal(name: string, _context: EvaluationContext): RuntimeValue | undefined {
    const normalized = normalizeName(name);
    if (normalized === 'cells') {
      return createCallable('Cells', (args) => {
        if (args.length !== 2) {
          throw new RuntimeError('Cells は row, column の 2 引数が必要なんな');
        }
        return createHostObject(new ExcelCellObject(this, asNumber(args[0]), asNumber(args[1])));
      });
    }
    if (normalized === 'range') {
      return createCallable('Range', (args) => {
        if (args.length !== 1) {
          throw new RuntimeError('Range は文字列 1 引数だけ対応なんな');
        }
        const text = scalarToString(asScalar(args[0]));
        const cells = this.resolveRange(text);
        return createHostObject(new ExcelRangeObject(cells));
      });
    }
    return undefined;
  }

  readCell(row: number, column: number): ScalarValue {
    return this.sheet.get(formatCellAddress(row, column).toUpperCase()) ?? null;
  }

  writeCell(row: number, column: number, value: ScalarValue): void {
    if (this.sheet.size > this.limits.maxCells && !this.sheet.has(formatCellAddress(row, column).toUpperCase())) {
      throw new RuntimeError('セル数上限を超えたんな', undefined, 'MemoryLimit');
    }
    this.sheet.set(formatCellAddress(row, column).toUpperCase(), value);
  }

  snapshot(_problem: ProblemDefinition): HostSnapshot {
    return {
      sheet: Object.fromEntries([...this.sheet.entries()].sort(([a], [b]) => a.localeCompare(b)))
    };
  }

  private resolveRange(address: string): ExcelCellObject[] {
    if (!address.includes(':')) {
      const parsed = parseCellAddress(address);
      return [new ExcelCellObject(this, parsed.row, parsed.column)];
    }
    const [startAddress, endAddress] = address.split(':');
    const start = parseCellAddress(startAddress);
    const end = parseCellAddress(endAddress);
    const cells: ExcelCellObject[] = [];
    for (let row = start.row; row <= end.row; row += 1) {
      for (let column = start.column; column <= end.column; column += 1) {
        cells.push(new ExcelCellObject(this, row, column));
      }
    }
    return cells;
  }
}

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    const runningOnNode = Boolean((globalThis as { process?: { versions?: { node?: string } } }).process?.versions?.node);
    const nodeUrlModule = 'node:url';
    const nodeFileURLToPath = runningOnNode
      ? ((await import(/* @vite-ignore */ nodeUrlModule)) as { fileURLToPath: (url: URL) => string }).fileURLToPath
      : undefined;
    sqlJsPromise = initSqlJs({
      locateFile: (file: string) => {
        if (nodeFileURLToPath) {
          return nodeFileURLToPath(new URL(`../../node_modules/sql.js/dist/${file}`, import.meta.url));
        }
        return `/sql/${file}`;
      }
    });
  }
  return sqlJsPromise;
}

class AccessDatabaseObject implements HostObject {
  readonly typeName = 'CurrentDb';
  private readonly host: AccessHost;

  constructor(host: AccessHost) {
    this.host = host;
  }

  getMember(name: string, _context: EvaluationContext): RuntimeValue {
    const normalized = normalizeName(name);
    if (normalized === 'openrecordset') {
      return createCallable('OpenRecordset', ([source], context) => this.callMember?.('OpenRecordset', [source], context) ?? null);
    }
    if (normalized === 'execute') {
      return createCallable('Execute', ([sql], context) => this.callMember?.('Execute', [sql], context) ?? null);
    }
    throw new RuntimeError(`CurrentDb.${name} は未対応なんな`);
  }

  callMember(name: string, args: RuntimeValue[], _context: EvaluationContext): RuntimeValue {
    const normalized = normalizeName(name);
    if (normalized === 'openrecordset') {
      return createHostObject(this.host.openRecordset(scalarToString(asScalar(args[0]))));
    }
    if (normalized === 'execute') {
      this.host.executeSql(scalarToString(asScalar(args[0])));
      return null;
    }
    throw new RuntimeError(`CurrentDb.${name} は未対応なんな`);
  }
}

class AccessDoCmdObject implements HostObject {
  readonly typeName = 'DoCmd';
  private readonly host: AccessHost;

  constructor(host: AccessHost) {
    this.host = host;
  }

  getMember(name: string, _context: EvaluationContext): RuntimeValue {
    if (normalizeName(name) === 'runsql') {
      return createCallable('RunSQL', ([sql], context) => this.callMember?.('RunSQL', [sql], context) ?? null);
    }
    throw new RuntimeError(`DoCmd.${name} は未対応なんな`);
  }

  callMember(name: string, args: RuntimeValue[], _context: EvaluationContext): RuntimeValue {
    if (normalizeName(name) === 'runsql') {
      this.host.executeSql(scalarToString(asScalar(args[0])));
      return null;
    }
    throw new RuntimeError(`DoCmd.${name} は未対応なんな`);
  }
}

class AccessRecordsetObject implements HostObject {
  readonly typeName = 'Recordset';
  private readonly host: AccessHost;
  private readonly sourceTable: string | null;
  private readonly columns: string[];
  private readonly snapshotRows: Array<{ rowid: number; row: Record<string, ScalarValue> }>;
  private index = 0;
  private editBuffer: Record<string, ScalarValue> | null = null;
  private addNewBuffer: Record<string, ScalarValue> | null = null;

  constructor(
    host: AccessHost,
    sourceTable: string | null,
    columns: string[],
    snapshotRows: Array<{ rowid: number; row: Record<string, ScalarValue> }>
  ) {
    this.host = host;
    this.sourceTable = sourceTable;
    this.columns = columns;
    this.snapshotRows = snapshotRows;
  }

  getMember(name: string, _context: EvaluationContext): RuntimeValue {
    const normalized = normalizeName(name);
    if (normalized === 'eof') {
      return this.index >= this.snapshotRows.length;
    }
    if (normalized === 'fields') {
      return createCallable(name, (args) => this.callMember('Fields', args, {} as EvaluationContext));
    }
    if (normalized === 'movenext' || normalized === 'edit' || normalized === 'update' || normalized === 'delete' || normalized === 'addnew') {
      return createCallable(name, (_args, context) => this.callMember?.(name, [], context) ?? null);
    }
    throw new RuntimeError(`Recordset.${name} は未対応なんな`);
  }

  callMember(name: string, _args: RuntimeValue[], _context: EvaluationContext): RuntimeValue {
    const normalized = normalizeName(name);
    switch (normalized) {
      case 'movenext':
        this.index += 1;
        return null;
      case 'edit':
        this.ensureCurrentRowExists();
        this.ensureUpdatable();
        this.editBuffer = { ...this.snapshotRows[this.index].row };
        return null;
      case 'addnew':
        this.ensureUpdatable();
        this.addNewBuffer = Object.fromEntries(this.columns.map((column) => [column, null]));
        return null;
      case 'update':
        if (this.addNewBuffer) {
          this.host.insertRow(this.sourceTable as string, this.addNewBuffer);
          this.addNewBuffer = null;
          return null;
        }
        if (this.editBuffer) {
          const row = this.snapshotRows[this.index];
          this.host.updateRow(this.sourceTable as string, row.rowid, this.editBuffer);
          this.editBuffer = null;
          return null;
        }
        throw new RuntimeError('Update の前に Edit か AddNew が必要なんな');
      case 'delete': {
        this.ensureCurrentRowExists();
        this.ensureUpdatable();
        const row = this.snapshotRows[this.index];
        this.host.deleteRow(this.sourceTable as string, row.rowid);
        return null;
      }
      case 'fields':
        return this.readField(scalarToString(asScalar(_args[0])));
      default:
        throw new RuntimeError(`Recordset.${name} は未対応なんな`);
    }
  }

  getCallReference(name: string, args: RuntimeValue[], _context: EvaluationContext): ValueReference | undefined {
    if (normalizeName(name) !== 'fields') {
      return undefined;
    }
    const fieldName = scalarToString(asScalar(args[0]));
    return {
      get: () => this.readField(fieldName),
      set: (value: RuntimeValue) => {
        const scalar = asScalar(value);
        if (this.addNewBuffer) {
          this.addNewBuffer[fieldName] = scalar;
          return;
        }
        if (!this.editBuffer) {
          throw new RuntimeError('Fields に代入する前に Edit が必要なんな');
        }
        this.editBuffer[fieldName] = scalar;
      }
    };
  }

  private readField(fieldName: string): ScalarValue {
    if (this.addNewBuffer) {
      return this.addNewBuffer[fieldName] ?? null;
    }
    this.ensureCurrentRowExists();
    if (this.editBuffer) {
      return this.editBuffer[fieldName] ?? null;
    }
    return this.snapshotRows[this.index].row[fieldName] ?? null;
  }

  private ensureCurrentRowExists(): void {
    if (this.index >= this.snapshotRows.length) {
      throw new RuntimeError('EOF の位置で Recordset を読んでいるんな');
    }
  }

  private ensureUpdatable(): void {
    if (!this.sourceTable) {
      throw new RuntimeError('この Recordset は更新できないんな');
    }
  }
}

class AccessHost implements VbaHost {
  readonly engine: EngineType = 'access';
  private readonly db: Database;
  private readonly limits: EngineLimits;
  private readonly tableDefinitions: Record<string, string[]>;
  private preparedQuery?: string;

  private constructor(db: Database, limits: EngineLimits, tableDefinitions: Record<string, string[]>) {
    this.db = db;
    this.limits = limits;
    this.tableDefinitions = tableDefinitions;
  }

  static async create(initialDb: ProblemDefinition['initialDb'], limits: EngineLimits): Promise<AccessHost> {
    const SqlJs = await getSqlJs();
    const db = new SqlJs.Database();
    const tableDefinitions: Record<string, string[]> = {};
    let rowCount = 0;
    let estimatedBytes = 0;

    try {
      if (initialDb) {
        for (const [tableName, table] of Object.entries(initialDb)) {
          tableDefinitions[tableName] = [...table.columns];
          db.run(`CREATE TABLE ${quoteIdentifier(tableName)} (${table.columns.map((column) => `${quoteIdentifier(column)} NUMERIC`).join(', ')})`);
          for (const row of table.rows) {
            rowCount += 1;
            estimatedBytes += JSON.stringify(row).length * 2;
            if (rowCount > limits.maxRowsPerTable) {
              throw new RuntimeError('初期テーブル行数が上限を超えたんな', undefined, 'MemoryLimit');
            }
            if (estimatedBytes > limits.maxEstimatedBytes) {
              throw new RuntimeError('初期 DB サイズが大きすぎるんな', undefined, 'MemoryLimit');
            }
            const statement = db.prepare(
              `INSERT INTO ${quoteIdentifier(tableName)} (${table.columns.map(quoteIdentifier).join(', ')}) VALUES (${table.columns.map(() => '?').join(', ')})`
            );
            statement.run(row);
            statement.free();
          }
        }
      }

      return new AccessHost(db, limits, tableDefinitions);
    } catch (error) {
      db.close();
      throw error;
    }
  }

  getGlobal(name: string, _context: EvaluationContext): RuntimeValue | undefined {
    const normalized = normalizeName(name);
    if (normalized === 'currentdb') {
      return createHostObject(new AccessDatabaseObject(this));
    }
    if (normalized === 'docmd') {
      return createHostObject(new AccessDoCmdObject(this));
    }
    return undefined;
  }

  openRecordset(source: string): AccessRecordsetObject {
    const trimmed = source.trim();
    const sourceTable = this.tableDefinitions[trimmed] ? trimmed : null;
    const selectSql = sourceTable
      ? `SELECT rowid, ${this.tableDefinitions[sourceTable].map(quoteIdentifier).join(', ')} FROM ${quoteIdentifier(sourceTable)}`
      : this.translateSql(trimmed, { forSelect: true, allowTop: true, includeRowId: true });
    const result = this.db.exec(selectSql);
    const columns = sourceTable
      ? this.tableDefinitions[sourceTable]
      : result[0]
        ? result[0].columns.filter((column: string) => column.toLowerCase() !== 'rowid')
        : [];
    const values = result[0]?.values ?? [];
    const snapshotRows = values.map((row: unknown[]) => {
      const rowid = Number(row[0]);
      const mapped: Record<string, ScalarValue> = {};
      columns.forEach((column: string, index: number) => {
        mapped[column] = toScalar(row[index + 1]);
      });
      return { rowid, row: mapped };
    });
    return new AccessRecordsetObject(this, sourceTable, columns, snapshotRows);
  }

  executeSql(sql: string): void {
    const translated = this.translateSql(sql, { forSelect: false, allowTop: false, includeRowId: false });
    this.db.run(translated);
  }

  insertRow(tableName: string, row: Record<string, ScalarValue>): void {
    const columns = this.tableDefinitions[tableName];
    if (!columns) {
      throw new RuntimeError(`テーブル ${tableName} が見つからないんな`);
    }
    const statement = this.db.prepare(
      `INSERT INTO ${quoteIdentifier(tableName)} (${columns.map(quoteIdentifier).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`
    );
    statement.run(columns.map((column) => row[column] ?? null));
    statement.free();
  }

  updateRow(tableName: string, rowid: number, row: Record<string, ScalarValue>): void {
    const columns = this.tableDefinitions[tableName];
    if (!columns) {
      throw new RuntimeError(`テーブル ${tableName} が見つからないんな`);
    }
    const statement = this.db.prepare(
      `UPDATE ${quoteIdentifier(tableName)} SET ${columns.map((column) => `${quoteIdentifier(column)} = ?`).join(', ')} WHERE rowid = ?`
    );
    statement.run([...columns.map((column) => row[column] ?? null), rowid]);
    statement.free();
  }

  deleteRow(tableName: string, rowid: number): void {
    this.db.run(`DELETE FROM ${quoteIdentifier(tableName)} WHERE rowid = ${rowid}`);
  }

  dLookup(fieldName: string, domain: string, criteria?: string): RuntimeValue {
    const rows = this.runDomainQuery(fieldName, domain, criteria, 'SELECT', 'LIMIT 1');
    return toRuntimeValue(rows[0]?.[0] ?? null);
  }

  dCount(fieldName: string, domain: string, criteria?: string): RuntimeValue {
    const expression = fieldName === '*' ? '*' : quoteIdentifier(fieldName);
    const rows = this.runDomainQuery(expression, domain, criteria, 'COUNT');
    return Number(rows[0]?.[0] ?? 0);
  }

  dSum(fieldName: string, domain: string, criteria?: string): RuntimeValue {
    const rows = this.runDomainQuery(quoteIdentifier(fieldName), domain, criteria, 'SUM');
    return Number(rows[0]?.[0] ?? 0);
  }

  prepareJudgeQuery(sql: string): void {
    this.preparedQuery = sql;
  }

  readQueryRows(sql: string): unknown[][] {
    const translated = this.translateSql(sql, { forSelect: true, allowTop: true, includeRowId: false });
    const result = this.db.exec(translated);
    return (result[0]?.values ?? []).map((row: unknown[]) => row.map((item: unknown) => toScalar(item)));
  }

  snapshot(problem: ProblemDefinition): HostSnapshot {
    const tables: Record<string, unknown[][]> = {};
    for (const [tableName, columns] of Object.entries(this.tableDefinitions)) {
      const result = this.db.exec(
        `SELECT ${columns.map(quoteIdentifier).join(', ')} FROM ${quoteIdentifier(tableName)} ORDER BY rowid`
      );
      tables[tableName] = (result[0]?.values ?? []).map((row: unknown[]) => row.map((value: unknown) => toScalar(value)));
    }
    const queries: Record<string, unknown[][]> = {};
    if (problem.judge.type === 'query') {
      queries[problem.judge.sql] = this.readQueryRows(problem.judge.sql);
    }
    return {
      tables,
      queries
    };
  }

  dispose(): void {
    this.db.close();
  }

  private runDomainQuery(
    fieldName: string,
    domain: string,
    criteria: string | undefined,
    mode: 'SELECT' | 'COUNT' | 'SUM',
    suffix?: string
  ): unknown[][] {
    const selectExpression =
      mode === 'SELECT' ? fieldName : mode === 'COUNT' ? `COUNT(${fieldName})` : `SUM(${fieldName})`;
    const criteriaSql = criteria ? ` WHERE ${this.translateExpression(criteria)}` : '';
    const sql = `SELECT ${selectExpression} FROM ${quoteIdentifier(domain)}${criteriaSql}${suffix ? ` ${suffix}` : ''}`;
    const result = this.db.exec(sql);
    return result[0]?.values ?? [];
  }

  private translateSql(
    sql: string,
    options: { forSelect: boolean; allowTop: boolean; includeRowId: boolean }
  ): string {
    const normalized = sql.trim();
    if (testOutsideSqlStrings(normalized, /\b(?:join|create|alter|drop)\b/i)) {
      throw new RuntimeError('この SQL 構文は v0.1 の対象外なんな', undefined, 'UnsupportedSyntax');
    }
    let translated = normalized;
    translated = replaceRegexOutsideSqlStrings(translated, /#([^#]+)#/g, (_match, value) => `'${value}'`);
    translated = replaceRegexOutsideSqlStrings(translated, /\btrue\b/gi, () => '-1');
    translated = replaceRegexOutsideSqlStrings(translated, /\bfalse\b/gi, () => '0');
    translated = replaceOutsideStrings(translated, '&', '||');
    translated = translated.replace(/\bLIKE\s+'([^']*)'/gi, (_match, pattern) => {
      const converted = String(pattern).replace(/\*/g, '%').replace(/\?/g, '_');
      return `LIKE '${converted}'`;
    });
    translated = rewriteFunctionCalls(translated, 'Nz', (args) => `COALESCE(${args[0]}, ${args[1] ?? "''"})`);
    translated = rewriteFunctionCalls(translated, 'IIf', (args) => `CASE WHEN ${args[0]} THEN ${args[1]} ELSE ${args[2]} END`);
    if (testOutsideSqlStrings(translated, /\bformat\s*\(/i)) {
      throw new RuntimeError('Format は v0.1 では非対応なんな', undefined, 'UnsupportedSyntax');
    }
    if (options.allowTop) {
      const match = translated.match(/^\s*select\s+top\s+(\d+)\s+/i);
      if (match) {
        translated = translated.replace(/^\s*select\s+top\s+\d+\s+/i, 'SELECT ');
        translated = `${translated} LIMIT ${match[1]}`;
      }
    }
    if (options.includeRowId && /^\s*select\b/i.test(translated) && !/\browid\b/i.test(translated)) {
      translated = translated.replace(/^\s*select\s+/i, 'SELECT rowid, ');
    }
    return translated;
  }

  private translateExpression(criteria: string): string {
    let translated = criteria;
    translated = replaceRegexOutsideSqlStrings(translated, /#([^#]+)#/g, (_match, value) => `'${value}'`);
    translated = replaceRegexOutsideSqlStrings(translated, /\btrue\b/gi, () => '-1');
    translated = replaceRegexOutsideSqlStrings(translated, /\bfalse\b/gi, () => '0');
    translated = replaceOutsideStrings(translated, '&', '||');
    translated = translated.replace(/\bLIKE\s+'([^']*)'/gi, (_match, pattern) => {
      const converted = String(pattern).replace(/\*/g, '%').replace(/\?/g, '_');
      return `LIKE '${converted}'`;
    });
    translated = rewriteFunctionCalls(translated, 'Nz', (args) => `COALESCE(${args[0]}, ${args[1] ?? "''"})`);
    translated = rewriteFunctionCalls(translated, 'IIf', (args) => `CASE WHEN ${args[0]} THEN ${args[1]} ELSE ${args[2]} END`);
    return translated;
  }
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function replaceOutsideStrings(source: string, target: string, replacement: string): string {
  return replaceRegexOutsideSqlStrings(source, new RegExp(escapeRegExp(target), 'g'), () => replacement);
}

function testOutsideSqlStrings(source: string, pattern: RegExp): boolean {
  const flags = pattern.flags.replace('g', '');
  const segmentPattern = new RegExp(pattern.source, flags);
  return splitSqlStringSegments(source).some((segment) => !segment.inString && segmentPattern.test(segment.text));
}

function replaceRegexOutsideSqlStrings(source: string, pattern: RegExp, replacement: (...args: string[]) => string): string {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const segmentPattern = new RegExp(pattern.source, flags);
  return splitSqlStringSegments(source)
    .map((segment) => {
      if (segment.inString) {
        return segment.text;
      }
      return segment.text.replace(segmentPattern, (...args) => replacement(...args.map(String)));
    })
    .join('');
}

function splitSqlStringSegments(source: string): Array<{ text: string; inString: boolean }> {
  const pieces: Array<{ text: string; inString: boolean }> = [];
  let index = 0;
  let segmentStart = 0;
  while (index < source.length) {
    if (source[index] !== '\'') {
      index += 1;
      continue;
    }
    if (segmentStart < index) {
      pieces.push({ text: source.slice(segmentStart, index), inString: false });
    }
    let stringEnd = index + 1;
    while (stringEnd < source.length) {
      if (source[stringEnd] === '\'' && source[stringEnd + 1] === '\'') {
        stringEnd += 2;
        continue;
      }
      if (source[stringEnd] === '\'') {
        stringEnd += 1;
        break;
      }
      stringEnd += 1;
    }
    pieces.push({ text: source.slice(index, stringEnd), inString: true });
    index = stringEnd;
    segmentStart = index;
  }
  if (segmentStart < source.length) {
    pieces.push({ text: source.slice(segmentStart), inString: false });
  }
  return pieces;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rewriteFunctionCalls(source: string, functionName: string, rewrite: (args: string[]) => string): string {
  const pattern = new RegExp(`\\b${functionName}\\s*\\(`, 'ig');
  let match = pattern.exec(source);
  let output = source;
  while (match) {
    const start = match.index;
    const openIndex = start + match[0].length - 1;
    const closeIndex = findMatchingParen(output, openIndex);
    const args = splitArgs(output.slice(openIndex + 1, closeIndex));
    const rewritten = rewrite(args);
    output = `${output.slice(0, start)}${rewritten}${output.slice(closeIndex + 1)}`;
    pattern.lastIndex = start + rewritten.length;
    match = pattern.exec(output);
  }
  return output;
}

function findMatchingParen(source: string, openIndex: number): number {
  let depth = 0;
  let inString = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === '\'') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  throw new RuntimeError('関数呼び出しの括弧が閉じていないんな');
}

function splitArgs(source: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let inString = false;
  let current = '';
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '\'') {
      inString = !inString;
      current += char;
      continue;
    }
    if (!inString) {
      if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        depth -= 1;
      } else if (char === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
        continue;
      }
    }
    current += char;
  }
  if (current.trim()) {
    args.push(current.trim());
  }
  return args;
}

function toScalar(value: unknown): ScalarValue {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  return String(value);
}

function wrapSource(problem: ProblemDefinition, source: string): string {
  if (problem.entryMode === 'fullModule') {
    return source;
  }
  return `Sub ${problem.entryPoint}()\n${source}\nEnd Sub`;
}

function parseModule(source: string): ModuleNode {
  const tokenizer = new Tokenizer(source);
  const tokens = tokenizer.tokenize();
  const parser = new Parser(tokens);
  return parser.parseModule();
}

export function getSemanticsProfile(): SemanticsProfile {
  return SEMANTICS_PROFILE;
}

export function getEngineCapabilities(engine: EngineType): EngineCapabilityManifest {
  return ENGINE_CAPABILITIES[engine];
}

export function validateProblem(problem: ProblemDefinition): ValidationResult {
  const diagnostics: Diagnostic[] = [];
  const lesson = problem.lesson;
  if (!problem.id.trim()) {
    diagnostics.push({ kind: 'Validation', severity: 'error', message: 'problem.id は必須なんな' });
  }
  if (!problem.entryPoint.trim()) {
    diagnostics.push({ kind: 'Validation', severity: 'error', message: 'entryPoint は必須なんな' });
  }
  if (problem.engine === 'excel' && !problem.initialSheet) {
    diagnostics.push({ kind: 'Validation', severity: 'error', message: 'Excel 問題には initialSheet が必要なんな' });
  }
  if (problem.engine === 'access' && !problem.initialDb) {
    diagnostics.push({ kind: 'Validation', severity: 'error', message: 'Access 問題には initialDb が必要なんな' });
  }
  if (problem.judge.type === 'cell' && problem.engine !== 'excel') {
    diagnostics.push({ kind: 'Validation', severity: 'error', message: 'cell 判定は Excel 問題だけなんな' });
  }
  if ((problem.judge.type === 'table' || problem.judge.type === 'query') && problem.engine !== 'access') {
    diagnostics.push({ kind: 'Validation', severity: 'error', message: 'table/query 判定は Access 問題だけなんな' });
  }
  if (!lesson) {
    diagnostics.push({ kind: 'Validation', severity: 'error', message: 'lesson は必須なんな' });
  } else {
    if (!lesson.overview.trim()) {
      diagnostics.push({ kind: 'Validation', severity: 'error', message: 'lesson.overview は必須なんな' });
    }
    if (!lesson.steps.length || lesson.steps.some((step) => !step.trim())) {
      diagnostics.push({ kind: 'Validation', severity: 'error', message: 'lesson.steps は 1 件以上の説明が必要なんな' });
    }
    if (!lesson.focusItems.length) {
      diagnostics.push({ kind: 'Validation', severity: 'error', message: 'lesson.focusItems は 1 件以上必要なんな' });
    }
    if (lesson.focusItems.some((item) => !item.name.trim() || !item.description.trim() || !item.example.trim())) {
      diagnostics.push({ kind: 'Validation', severity: 'error', message: 'lesson.focusItems の各項目には name/description/example が必要なんな' });
    }
    if (!lesson.reviewCards.length) {
      diagnostics.push({ kind: 'Validation', severity: 'error', message: 'lesson.reviewCards は 1 件以上必要なんな' });
    }
    if (lesson.reviewCards.some((card) => !card.question.trim() || !card.answer.trim())) {
      diagnostics.push({ kind: 'Validation', severity: 'error', message: 'lesson.reviewCards の各項目には question/answer が必要なんな' });
    }
  }
  try {
    parseModule(wrapSource(problem, problem.answer));
  } catch (error) {
    if (error instanceof ParseError) {
      diagnostics.push(error.diagnostic);
    } else {
      diagnostics.push({
        kind: 'Validation',
        severity: 'error',
        message: error instanceof Error ? error.message : '模範解答の解析に失敗したんな'
      });
    }
  }
  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== 'error'),
    diagnostics
  };
}

export function judgeResult(problem: ProblemDefinition, runResult: RunResult): JudgeResult {
  if (!runResult.ok) {
    return {
      passed: false,
      summary: '実行エラーで採点できなかったんな',
      diagnostics: runResult.diagnostics
    };
  }
  try {
    switch (problem.judge.type) {
      case 'cell': {
        const sheet = runResult.snapshot.sheet ?? {};
        const expectedEntries = Object.entries(problem.judge.expected);
        for (const [address, expected] of expectedEntries) {
          if (!valuesEqual(sheet[address.toUpperCase()], expected, problem.judge.epsilon ?? DEFAULT_EPSILON)) {
            return {
              passed: false,
              summary: `${address} の値が期待と違うんな`,
              diagnostics: []
            };
          }
        }
        return {
          passed: true,
          summary: 'セル状態が一致したんな',
          diagnostics: []
        };
      }
      case 'debug': {
        const actual = runResult.debugLines.map(normalizeDebugLine).filter(Boolean);
        const expected = problem.judge.expectedLines.map(normalizeDebugLine).filter(Boolean);
        if (
          actual.length !== expected.length ||
          actual.some((line, index) => !debugLinesEqual(line, expected[index], problem.judge.epsilon ?? DEFAULT_EPSILON))
        ) {
          return {
            passed: false,
            summary: 'Debug.Print の出力が期待と違うんな',
            diagnostics: []
          };
        }
        return {
          passed: true,
          summary: 'Debug.Print が一致したんな',
          diagnostics: []
        };
      }
      case 'return': {
        if (!valuesEqual(runResult.returnValue, problem.judge.expected, problem.judge.epsilon ?? DEFAULT_EPSILON)) {
          return {
            passed: false,
            summary: '戻り値が期待と違うんな',
            diagnostics: []
          };
        }
        return {
          passed: true,
          summary: '戻り値が一致したんな',
          diagnostics: []
        };
      }
      case 'table': {
        const actual = runResult.snapshot.tables?.[problem.judge.table] ?? [];
        const expected = problem.judge.expectedRows;
        if (!compareRowSets(actual, expected, problem.judge.preserveOrder ?? false, problem.judge.epsilon ?? DEFAULT_EPSILON)) {
          return {
            passed: false,
            summary: `テーブル ${problem.judge.table} の状態が期待と違うんな`,
            diagnostics: []
          };
        }
        return {
          passed: true,
          summary: 'テーブル状態が一致したんな',
          diagnostics: []
        };
      }
      case 'query': {
        const actual = runResult.snapshot.queries?.[problem.judge.sql] ?? [];
        if (!compareRowSets(actual, problem.judge.expectedRows, problem.judge.preserveOrder ?? false, problem.judge.epsilon ?? DEFAULT_EPSILON)) {
          return {
            passed: false,
            summary: 'クエリ結果が期待と違うんな',
            diagnostics: []
          };
        }
        return {
          passed: true,
          summary: 'クエリ結果が一致したんな',
          diagnostics: []
        };
      }
    }
  } catch (error) {
    return {
      passed: false,
      summary: error instanceof Error ? error.message : '採点に失敗したんな',
      diagnostics: []
    };
  }
}

function valuesEqual(left: unknown, right: unknown, epsilon: number): boolean {
  if (typeof left === 'number' && typeof right === 'number') {
    return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= epsilon;
  }
  return JSON.stringify(left) === JSON.stringify(right);
}

function debugLinesEqual(actual: string, expected: string, epsilon: number): boolean {
  const actualTokens = actual.split(/\s+/).filter(Boolean);
  const expectedTokens = expected.split(/\s+/).filter(Boolean);
  if (actualTokens.length !== expectedTokens.length) {
    return false;
  }
  return actualTokens.every((token, index) => debugTokensEqual(token, expectedTokens[index], epsilon));
}

function debugTokensEqual(actual: string, expected: string, epsilon: number): boolean {
  const actualNumber = parseFiniteNumberToken(actual);
  const expectedNumber = parseFiniteNumberToken(expected);
  if (actualNumber !== undefined && expectedNumber !== undefined) {
    return valuesEqual(actualNumber, expectedNumber, epsilon);
  }
  return valuesEqual(actual, expected, epsilon);
}

function parseFiniteNumberToken(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function compareRowSets(actual: unknown[][], expected: unknown[][], preserveOrder: boolean, epsilon: number): boolean {
  if (actual.length !== expected.length) {
    return false;
  }
  if (preserveOrder) {
    return actual.every((row, index) => rowEqual(row, expected[index], epsilon));
  }
  const usedActualRows = new Set<number>();
  return expected.every((expectedRow) => {
    const actualIndex = actual.findIndex((actualRow, index) => !usedActualRows.has(index) && rowEqual(actualRow, expectedRow, epsilon));
    if (actualIndex === -1) {
      return false;
    }
    usedActualRows.add(actualIndex);
    return true;
  });
}

function rowEqual(actual: unknown[], expected: unknown[], epsilon: number): boolean {
  return actual.length === expected.length && actual.every((value, index) => valuesEqual(value, expected[index], epsilon));
}

export async function runSubmission(
  problem: ProblemDefinition,
  source: string,
  limits: EngineLimits = DEFAULT_LIMITS
): Promise<RunResult> {
  let host: VbaHost | undefined;
  try {
    const wrappedSource = wrapSource(problem, source);
    const module = parseModule(wrappedSource);
    host =
      problem.engine === 'excel'
        ? new ExcelHost(problem.initialSheet, limits)
        : await AccessHost.create(problem.initialDb, limits);
    const interpreter = new Interpreter(module, host, limits);
    return interpreter.execute(problem);
  } catch (error) {
    const diagnostic = error instanceof ParseError || error instanceof RuntimeError
      ? error.diagnostic
      : {
          kind: 'Runtime' as const,
          severity: 'error' as const,
          message: error instanceof Error ? error.message : '不明なエラーなんな'
        };
    return {
      ok: false,
      diagnostics: [diagnostic],
      debugLines: [],
      snapshot: {},
      durationMs: 0
    };
  } finally {
    host?.dispose?.();
  }
}

export async function checkProblemSet(problems: ProblemDefinition[]): Promise<ValidationSummary> {
  const results: ValidationSummary['results'] = [];
  for (const problem of problems) {
    const validation = validateProblem(problem);
    if (!validation.valid) {
      results.push({
        problemId: problem.id,
        valid: false,
        diagnostics: validation.diagnostics
      });
      continue;
    }
    const runResult = await runSubmission(problem, problem.answer);
    const result = judgeResult(problem, runResult);
    results.push({
      problemId: problem.id,
      valid: result.passed,
      diagnostics: [...validation.diagnostics, ...runResult.diagnostics, ...result.diagnostics]
    });
  }
  return {
    valid: results.every((result) => result.valid),
    results
  };
}
