import type { AppContext } from "@/worker";
import type { RequestInfo } from "rwsdk/worker";

export function checkIfTeamSetupSites({ ctx }: RequestInfo<any, AppContext>) {
    if (!ctx.initial_site_setup) {
        return new Response("User needs to create a site", {
            status: 303,
            headers: { location: "/new-site" },
        });
    }
    if (!ctx.sites) {
        return new Response("User needs to create a site", {
            status: 303,
            headers: { location: "/new-site" },
        });
    }
}
export function onlyAllowGetPost({ request }: RequestInfo<any, AppContext>) {
    if (!["GET", "POST"].includes(request.method))
        return new Response("Not Found.", { status: 404 });
}
