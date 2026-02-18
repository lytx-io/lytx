const Logo = () => (
  <div className="flex items-center gap-2 font-montserrat font-bold text-2xl tracking-tight">
    <img src="/logo.png" alt="Lytx logo" className="h-6 w-6" />
    <span>Lytx</span>
  </div>
);

export function MarketingFooter() {
  return (
    <footer className="bg-white border-t border-slate-200 py-16 dark:bg-black dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-1">
            <Logo />
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Privacy-friendly analytics for the modern web. Open source and transparent.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 dark:text-white">Product</h3>
            <ul className="space-y-3">
              <li><a href="/#features" className="text-slate-600 hover:text-amber-600 text-sm dark:text-slate-400 dark:hover:text-amber-400">Features</a></li>
              <li><a href="/signup" className="text-slate-600 hover:text-amber-600 text-sm dark:text-slate-400 dark:hover:text-amber-400">Get Started</a></li>
              <li><a href="/#demo" className="hidden text-slate-600 hover:text-amber-600 text-sm dark:text-slate-400 dark:hover:text-amber-400">Live Demo</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 dark:text-white">Resources</h3>
            <ul className="space-y-3">
              <li><a href="/api/docs" className="text-slate-600 hover:text-amber-600 text-sm dark:text-slate-400 dark:hover:text-amber-400">API Documentation</a></li>
              <li><a target="_blank" href="https://github.com/lytx-io/kit" className="text-slate-600 hover:text-amber-600 text-sm dark:text-slate-400 dark:hover:text-amber-400">GitHub</a></li>
              <li><a href="#" className="hidden text-slate-600 hover:text-amber-600 text-sm dark:text-slate-400 dark:hover:text-amber-400">Blog</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 dark:text-white">Legal</h3>
            <ul className="space-y-3">
              <li><a href="/privacy" className="text-slate-600 hover:text-amber-600 text-sm dark:text-slate-400 dark:hover:text-amber-400">Privacy Policy</a></li>
              <li><a href="/terms" className="text-slate-600 hover:text-amber-600 text-sm dark:text-slate-400 dark:hover:text-amber-400">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} Lytx. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
