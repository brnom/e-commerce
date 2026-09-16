export interface Config {
  readonly port: number;
  readonly databaseUrl: string;
  readonly webOrigin: string;
}

export const CONFIG = Symbol("Config");
