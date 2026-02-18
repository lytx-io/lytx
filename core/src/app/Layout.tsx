import type { LayoutProps } from "rwsdk/router";
import type { ContentItem } from "blinkx.io-sveltekit/dist/src/types/content";
import { Nav } from "@/app/components/Nav";
import type { NavInitialSession } from "@/app/components/Nav";
import { ClientProviders } from "@/app/providers/ClientProviders";
import type { RequestInfo } from "rwsdk/worker";
import type { AppContext } from "@/types/app-context";

export function AppLayout({
  children,
  requestInfo
}: LayoutProps<RequestInfo<any, AppContext>>) {
  const dashboardPrefetchHref = "/dashboard/settings";
  const session = requestInfo?.ctx?.session;
  const initialNavSession: NavInitialSession | null = session
    ? {
      user: {
        name: session.user?.name ?? null,
        email: session.user?.email ?? null,
        image: session.user?.image ?? null,
      },
      team: session.team
        ? {
          id: session.team.id,
          name: session.team.name ?? null,
          external_id: session.team.external_id ?? null,
        }
        : null,
      all_teams: Array.isArray(session.all_teams)
        ? session.all_teams.map((team) => ({
          id: team.id,
          name: team.name ?? null,
          external_id: team.external_id ?? null,
        }))
        : [],
    }
    : null;

  return (
    //NOTE: This was a way to get all the client side providers to work
    <ClientProviders>
      {session
        ? <link rel="x-prefetch" href={dashboardPrefetchHref} />
        : null}
      <main className="w-full max-w-[1400px] mx-auto">
        <Nav initialSession={initialNavSession} />
        {children}
      </main>
    </ClientProviders>
  );
}

export const Page = (props: { content: ContentItem["body"] }) => (
  <>
    <style dangerouslySetInnerHTML={{ __html: props.content.css }} />
    <div dangerouslySetInnerHTML={{ __html: props.content.html }} />
  </>
);
