// import { initSupabase } from "@/db/server";
import { AppContext } from "@/worker";
// import { env } from "cloudflare:workers";
// import { route } from "rwsdk/router";
import type { RequestInfo } from "rwsdk/worker";
import { auth } from "@lib/auth";

export function authMiddleware({ request }: RequestInfo<any, AppContext>) {
    if (["POST", "GET"].includes(request.method)) {
        return auth.handler(request);
    } else return new Response("Method Not Allowed", { status: 405 });
}

export async function sessionMiddleware({ request, ctx }: RequestInfo<any, AppContext>) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
        return new Response("Not logged in", { status: 303, headers: { location: '/login' } });
    }

    ctx.initial_site_setup = session.initial_site_setup;
    ctx.db_adapter = session.db_adapter;
    ctx.sites = session.userSites || null;
    ctx.session = session;
    ctx.team = session.team;
    ctx.user_role = session.role;

}

export function getSiteFromContext(ctx: AppContext, site_id: number) {
    if (!ctx.session) return null;
    if (!ctx.sites) return null;
    return ctx.sites.find(s => s.site_id == site_id);
}

export const sessionName = 'lytx_session';
