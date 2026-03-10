import {
  createLytxApp,
  SiteDurableObject,
  SyncDurableObject,
} from "lytx";
import { route } from "rwsdk/router";
import { Document } from "./components/document";

export { SyncDurableObject, SiteDurableObject };

const app = createLytxApp({
  cache: { persistHistoricalAnalyticsToEventsKv: true },
  db: {
    dbAdapter: "sqlite",
    eventStore: "durable_objects",
  },
  routes: {
    document: Document,
    additionalRoutes: [
      route("/test", ({ request }) => {
        const url = new URL(request.url);
        return (
          <main>
            <h1>Custom Route</h1>
            <p>Path: {url.pathname}</p>
          </main>
        );
      }),
    ],
  },
  auth: {
    signupMode: "demo",
  },
});

export default app;
