declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: new () => Database;
  }

  export interface ExecResult {
    columns: string[];
    values: unknown[][];
  }

  export interface Statement {
    run(values?: unknown[]): void;
    free(): void;
  }

  export class Database {
    run(sql: string): void;
    prepare(sql: string): Statement;
    exec(sql: string): ExecResult[];
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
  }): Promise<SqlJsStatic>;
}
