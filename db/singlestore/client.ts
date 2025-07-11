import { drizzle } from "drizzle-orm/singlestore";
import mysql from "mysql2/promise";

// For SingleStore, we need to create a connection using mysql2
// The connection string should be provided via environment variable
export const createSingleStoreClient = async (connectionString?: string) => {
  if (!connectionString) {
    throw new Error("SingleStore connection string is required");
  }

  const connection = await mysql.createConnection(connectionString);
  return drizzle({ client: connection });
};

// Alternative connection using connection options
export const createSingleStoreClientWithOptions = async (options: {
  host: string;
  user: string;
  password: string;
  database: string;
  port?: number;
}) => {
  const connection = await mysql.createConnection(options);
  return drizzle({ client: connection });
};

// For pool connections (recommended for production)
export const createSingleStorePool = (connectionString?: string) => {
  if (!connectionString) {
    throw new Error("SingleStore connection string is required");
  }

  const pool = mysql.createPool(connectionString);
  return drizzle({ client: pool });
};
