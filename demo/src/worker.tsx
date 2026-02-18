import { createLytxApp, SyncDurableObject, SiteDurableObject } from "@lytx/core";

export { SyncDurableObject, SiteDurableObject };

const app = createLytxApp({
  tagRoutes: {
    dbAdapter: "sqlite",
    useQueueIngestion: true,
  },
});

export default app;
