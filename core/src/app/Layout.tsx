import type { LayoutProps } from "rwsdk/router";
import type { ContentItem } from "blinkx.io-sveltekit/dist/src/types/content";
import { Nav } from "@/app/components/Nav";
import { ClientProviders } from "@/app/providers/ClientProviders";
import type { RequestInfo } from "rwsdk/worker";
import type { AppContext } from "@/worker";

export function AppLayout({
  children,
  requestInfo
}: LayoutProps<RequestInfo<any, AppContext>>) {
  // if (requestInfo) {
  //   const { ctx } = requestInfo;
  //   console.log('🔥🔥🔥 requestInfo', ctx.);
  // }
  return (
    //NOTE: This was a way to get all the client side providers to work
    <ClientProviders>
      <main className="w-full max-w-[1400px] mx-auto">
        <Nav />
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
