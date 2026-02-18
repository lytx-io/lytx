import type { RequestInfo } from "rwsdk/worker";
import type { AuthUserSession } from "@lib/auth";
import type { DBAdapter, UserRole } from "@db/types";
import type { SitesContext, TeamContext } from "@db/d1/sites";

export type AppContext = {
  session: AuthUserSession;
  initial_site_setup: boolean;
  sites: SitesContext | null;
  team: TeamContext;
  blink_id: string;
  user_role: UserRole;
  db_adapter: DBAdapter;
};

export type AppRequestInfo = RequestInfo<any, AppContext>;
