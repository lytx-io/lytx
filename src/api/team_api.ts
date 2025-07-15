import { route, prefix } from "rwsdk/router";
import type { RequestInfo } from "rwsdk/worker";
import { env } from "cloudflare:workers";
import type { AppContext } from "@/worker";
import type { DBAdapter } from "@db/types";

//PERF:  ALL ROUTES HERE WILL BE PREFIXED WITH /api/team
export const get_team_members = (adapter: DBAdapter) => route<RequestInfo<any, AppContext>>("/", [async ({ request }) => {

    return new Response("Not Found.", { status: 404 });

}]);





export const team_dashboard_endpoints = prefix("/team", [
    get_team_members("sqlite")
]);
