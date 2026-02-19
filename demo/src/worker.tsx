import { createLytxApp, SyncDurableObject, SiteDurableObject } from "@lytx/core";

export { SyncDurableObject, SiteDurableObject };

const app = createLytxApp({
  db: {
    dbAdapter: "sqlite",
  },
});

export default app;
