import { d1_client } from "@db/d1/client";
import { pg_client } from "@db/postgres/client";
import { DBAdapter } from "@db/d1/schema";

export type D1Client = typeof d1_client;
export type PGClient = ReturnType<typeof pg_client>;

export type AdapterToClient = {
  "sqlite": D1Client;
  "postgres": PGClient;
};


export function getClient<T extends DBAdapter>(adapter: T, connectionString?: string): AdapterToClient[T] {
  switch (adapter) {
    case "sqlite":
      return d1_client as AdapterToClient[T]
    case "postgres":
      if (!connectionString) throw new Error("connectionString is required for postgres");
      return pg_client(connectionString) as AdapterToClient[T];
    default:
      return d1_client as AdapterToClient[T];
  }
}

