import {
  createLytxApp,
  SiteDurableObject,
  SyncDurableObject,
} from "lytx";
import { route } from "rwsdk/router";

export { SyncDurableObject, SiteDurableObject };

const app = createLytxApp({
  db: {
    dbAdapter: "sqlite",
    eventStore: "durable_objects",
  },
  routes: {
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
