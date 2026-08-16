// apps/web/src/types/pg.d.ts
declare module "pg" {
  export class Client {
    constructor(config: {
      connectionString?: string
      statement_timeout?: number
    })
    connect(): Promise<void>
    query(
      text: string,
      params?: Array<string | number | boolean | null>,
    ): Promise<{ rows: Array<Record<string, unknown>> }>
    end(): Promise<void>
  }
}
