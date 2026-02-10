import {
  initClient,
  initClientNavigation,
} from "rwsdk/client";

const { handleResponse, onHydrated: originalOnHydrated } = initClientNavigation({
  scrollBehavior: "instant",
});

// Wrap onHydrated to complete any pending view transition
const onHydrated = () => {
  // Complete the view transition by resolving the promise
  if ((window as any).__viewTransitionResolve) {
    (window as any).__viewTransitionResolve();
    (window as any).__viewTransitionResolve = null;
  }
  
  // Call original onHydrated for cache management
  originalOnHydrated();
};

// Intercept link clicks to start view transitions BEFORE rwsdk handles them
document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const link = target.closest("a[href]") as HTMLAnchorElement | null;
  
  if (!link) return;
  
  // Skip external links, new tabs, modified clicks
  const href = link.getAttribute("href");
  if (!href || href.startsWith("http") || href.startsWith("//")) return;
  if (link.target === "_blank") return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  
  // Start view transition if supported
  if (document.startViewTransition) {
    document.startViewTransition(() => {
      return new Promise<void>((resolve) => {
        (window as any).__viewTransitionResolve = resolve;
      });
    });
  }
}, true); // Capture phase - run BEFORE rwsdk's handler

initClient({ handleResponse, onHydrated });

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}
