import { MarketingFooter } from "@/app/components/MarketingFooter";
import { MarketingNav } from "@/app/components/MarketingNav";
import { ThemeProvider } from "@/app/providers/ThemeProvider";

export function MarketingLayout({
  children,
  navLinks,
  navCta,
}: {
  children: React.ReactNode;
  navLinks?: { label: string; href: string }[];
  navCta?: { label: string; href: string };
}) {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-amber-100 selection:text-amber-900 dark:bg-black dark:text-slate-100">
        <MarketingNav links={navLinks} cta={navCta} />
        {children}
        <MarketingFooter />
      </div>
    </ThemeProvider>
  );
}
