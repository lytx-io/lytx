import { AppContext } from "@/worker";
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
    //Fix the ctx type
    ctx.sites = session.userSites || null;
    ctx.session = session;
    ctx.team = session.team;


}


export const sessionName = 'lytx_session';
