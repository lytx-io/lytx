import {
  createLytxApp,
  SiteDurableObject,
  SyncDurableObject,
  type LytxDashboardReportData,
} from "lytx";
import { route, type DocumentProps } from "rwsdk/router";

export { SyncDurableObject, SiteDurableObject };

const DashboardUiReplacement = (props: {
  defaultSettingsEnabled?: boolean;
  settingsEnabled: boolean;
  initialDashboardData: LytxDashboardReportData["initialDashboardData"];
}) => {
  return (
    <main>
      <h1>Custom Dashboard UI</h1>
      <p>Default settingsEnabled: {props.defaultSettingsEnabled}</p>
      <p>Overridden settingsEnabled: {props.settingsEnabled}</p>
    </main>
  );
};

const EventsUiReplacement = () => {
  return (
    <main>
      <h1>Custom Events UI</h1>
      <p>This route is fully replaced by consumer UI.</p>
    </main>
  );
};

const ExploreUiReplacement = (props: { initialSiteId: number | null }) => {
  return (
    <main>
      <h1>Custom Explore UI</h1>
      <p>Default initialSiteId: {String(props.initialSiteId)}</p>
    </main>
  );
};

const CustomDocument = ({ children }: DocumentProps) => {
  return (
    <html lang="en">
      <body data-demo="custom-document">{children}</body>
    </html>
  );
};

//TODO: show other types of combinatiosn ie clickhouse/singlestore etc with redis over kv etc
const app = createLytxApp({
  db: {
    dbAdapter: "sqlite",
    eventStore: "durable_objects",
  },
  routes: {
    // document: CustomDocument,
    ui: {},
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
  // routes: {
  //   ui: {
  //     dashboard: ({ defaultProps }) => {
  //       return (
  //         <DashboardUiReplacement
  //           defaultSettingsEnabled={defaultProps.settingsEnabled}
  //           settingsEnabled={false}
  //           initialDashboardData={defaultProps.reportData.initialDashboardData}
  //         />
  //       );
  //     },
  //     events: () => {
  //       return <EventsUiReplacement />;
  //     },
  //     explore: ({ defaultProps }) => {
  //       return <ExploreUiReplacement initialSiteId={defaultProps.initialSiteId} />;
  //     },
  //   },
  // },
  auth: {
    signupMode: "demo",
    // "demo" is intentionally unauthenticated for app/dashboard routes.
    // signupMode: "bootstrap_then_invite",
  },

  // ai: {
  //   provider: process.env.AI_PROVIDER?.trim() || undefined,
  //   // model: process.env.AI_MODEL?.trim() || undefined,
  // },
});

export default app;
