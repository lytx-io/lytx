export function SectionHeading({
  badge,
  title,
  subtitle,
  align = "center",
  as: Tag = "h2",
}: {
  badge?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  as?: "h1" | "h2";
}) {
  return (
    <div className={`mb-12 ${align === "center" ? "text-center" : "text-left"}`}>
      {badge && (
        <span className="inline-block py-1 px-3 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold uppercase tracking-wider mb-4 border border-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
          {badge}
        </span>
      )}
      <Tag
        className={`font-bold text-slate-900 dark:text-white mb-4 tracking-tight ${
          Tag === "h1" ? "text-4xl md:text-5xl" : "text-3xl md:text-4xl"
        }`}
      >
        {title}
      </Tag>
      {subtitle && (
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-[46rem] mx-auto leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
