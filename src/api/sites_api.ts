import { route } from "rwsdk/router";
import type { RequestInfo } from "rwsdk/worker";
import type { AppContext } from "@/worker";

/**
 * GET /api/world_countries
 *
 * This is the world countries API endpoint
 */
export const world_countries = route<RequestInfo<any, AppContext>>("/world_countries", async ({ request }) => {
    if (request.method != "POST")
        return new Response("Not Found.", { status: 404 });
    const include = (await request.json()) as { include: string[] };
    const world_countries = await import(
        "@lib/geojson/world_countries.json"
    );

    if (include.include.length > 0) {
        const filtered = world_countries.features.filter((feature) => {
            return include.include.includes(feature.properties.name);
        });
        return new Response(JSON.stringify(filtered));
    }
    //consider r2 bucket?
    return new Response(JSON.stringify(world_countries));
})
