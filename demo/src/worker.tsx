import { createLytxApp, SyncDurableObject, SiteDurableObject } from "lytx";

export { SyncDurableObject, SiteDurableObject };

//TODO: show other types of combinatiosn ie clickhouse/singlestore etc with redis over kv etc
const app = createLytxApp({
  db: {
    dbAdapter: "sqlite",
  },
  ai: {
    provider: process.env.AI_PROVIDER,
    model: process.env.AI_MODEL,
    baseURL: process.env.AI_BASE_URL,
  },
});

export default app;
