import { createLytxApp, SiteDurableObject, SyncDurableObject } from "lytx";

export { SyncDurableObject, SiteDurableObject };

const DashboardUiReplacement = (props: {
  defaultSettingsEnabled?: boolean;
  settingsEnabled: boolean;
  hasInitialDashboardData: boolean;
}) => {
  return (
    <main>
      <h1>Custom Dashboard UI</h1>
      <p>Default settingsEnabled: {String(props.defaultSettingsEnabled)}</p>
      <p>Overridden settingsEnabled: {String(props.settingsEnabled)}</p>
      <p>Has initial dashboard data: {String(props.hasInitialDashboardData)}</p>
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

//TODO: show other types of combinatiosn ie clickhouse/singlestore etc with redis over kv etc
const app = createLytxApp({
  db: {
    dbAdapter: "sqlite",
    eventStore: "durable_objects",
  },
  routes: {
    ui: {
      dashboard: ({ defaultProps }) => {
        return (
          <DashboardUiReplacement
            defaultSettingsEnabled={defaultProps.settingsEnabled}
            settingsEnabled={false}
            hasInitialDashboardData={Boolean(defaultProps.reportData.initialDashboardData)}
          />
        );
      },
      events: () => {
        return <EventsUiReplacement />;
      },
      explore: ({ defaultProps }) => {
        return <ExploreUiReplacement initialSiteId={defaultProps.initialSiteId} />;
      },
    },
  },
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
