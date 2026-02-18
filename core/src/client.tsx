import {
  initClient,
  initClientNavigation,
} from "rwsdk/client";

type NavigationRuntime = {
  handleResponse: ReturnType<typeof initClientNavigation>["handleResponse"];
  onHydrated: () => void;
  clickListener: (event: MouseEvent) => void;
};

declare global {
  interface Window {
    __lytxNavigationRuntime?: NavigationRuntime;
    __lytxClientInitialized?: boolean;
    __viewTransitionResolve?: (() => void) | null;
    __viewTransitionTimeoutId?: number | null;
  }
}

const clearPendingViewTransition = () => {
  if (window.__viewTransitionTimeoutId) {
    window.clearTimeout(window.__viewTransitionTimeoutId);
    window.__viewTransitionTimeoutId = null;
  }
  if (window.__viewTransitionResolve) {
    window.__viewTransitionResolve();
    window.__viewTransitionResolve = null;
  }
};

const createNavigationRuntime = (): NavigationRuntime => {
  const { handleResponse, onHydrated: originalOnHydrated } = initClientNavigation({
    scrollBehavior: "instant",
  });

  const onHydrated = () => {
    clearPendingViewTransition();
    originalOnHydrated();
  };

  const clickListener = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const link = target?.closest("a[href]") as HTMLAnchorElement | null;

    if (!link) return;
    if (link.target === "_blank" || link.hasAttribute("download")) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const href = link.getAttribute("href");
    if (!href || href.startsWith("//") || href.startsWith("http")) return;

    const nextUrl = new URL(link.href, window.location.href);
    const currentUrl = new URL(window.location.href);
    if (
      nextUrl.origin !== currentUrl.origin
      || (nextUrl.pathname === currentUrl.pathname
        && nextUrl.search === currentUrl.search
        && nextUrl.hash === currentUrl.hash)
    ) {
      return;
    }

    const startViewTransition = (document as any).startViewTransition as
      | ((callback: () => Promise<void>) => unknown)
      | undefined;
    if (!startViewTransition) return;

    clearPendingViewTransition();
    startViewTransition(() => {
      return new Promise<void>((resolve) => {
        window.__viewTransitionResolve = resolve;
        window.__viewTransitionTimeoutId = window.setTimeout(() => {
          clearPendingViewTransition();
        }, 1200);
      });
    });
  };

  document.addEventListener("click", clickListener, true);

  return {
    handleResponse,
    onHydrated,
    clickListener,
  };
};

const runtime = window.__lytxNavigationRuntime ?? createNavigationRuntime();
window.__lytxNavigationRuntime = runtime;

if (!window.__lytxClientInitialized) {
  initClient({ handleResponse: runtime.handleResponse, onHydrated: runtime.onHydrated });
  window.__lytxClientInitialized = true;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (window.__lytxNavigationRuntime) {
      document.removeEventListener("click", window.__lytxNavigationRuntime.clickListener, true);
    }
    window.__lytxNavigationRuntime = undefined;
    window.__lytxClientInitialized = false;
    clearPendingViewTransition();
  });
}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}
