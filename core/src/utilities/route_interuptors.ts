import type { AppContext } from "@/worker";
import type { RequestInfo } from "rwsdk/worker";

export function checkIfTeamSetupSites({ ctx }: RequestInfo<any, AppContext>) {
    if (!ctx.initial_site_setup) {
        return new Response("User needs to create a site", {
            status: 303,
            headers: { location: "/dashboard/new-site" },
        });
    }
    if (!ctx.sites || ctx.sites.length === 0) {
        return new Response("No sites are assigned to this user", {
            status: 403,
        });
    }
}
export function onlyAllowGetPost({ request }: RequestInfo<any, AppContext>) {
    if (!["GET", "POST"].includes(request.method))
        return new Response("Not Found.", { status: 404 });
}
export function onlyAllowPost({ request }: RequestInfo<any, AppContext>) {
    if (!["POST"].includes(request.method))
        return new Response("Not Found.", { status: 404 });
}
