import { createLytxApp, SyncDurableObject, SiteDurableObject } from "lytx";

export { SyncDurableObject, SiteDurableObject };

//TODO: show other types of combinatiosn ie clickhouse/singlestore etc with redis over kv etc
const app = createLytxApp({
  db: {
    dbAdapter: "sqlite",
  },
});

export default app;
