import { createLytxApp, SyncDurableObject, SiteDurableObject } from "lytx";

export { SyncDurableObject, SiteDurableObject };

//TODO: show other types of combinatiosn ie clickhouse/singlestore etc with redis over kv etc
const app = createLytxApp({
  db: {
    dbAdapter: "sqlite",
  },
  ai: {
    provider: process.env.AI_PROVIDER?.trim() || undefined,
    model: process.env.AI_MODEL?.trim() || undefined,
  },
});

export default app;
