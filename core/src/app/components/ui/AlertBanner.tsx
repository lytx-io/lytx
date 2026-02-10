type AlertTone = "success" | "error" | "info" | "warning";

type AlertToneConfig = {
  label: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
};

type AlertOverrides = Partial<AlertToneConfig>;

type AlertBannerProps = {
  tone?: AlertTone;
  title?: string;
  message: string;
  onDismiss?: () => void;
  className?: string;
  accent?: AlertOverrides;
};

const toneStyles: Record<AlertTone, AlertToneConfig> = {
  success: {
    label: "Success",
    borderClass: "border-emerald-500/60",
    bgClass: "bg-emerald-500/10",
    textClass: "text-emerald-400",
  },
  error: {
    label: "Error",
    borderClass: "border-red-500/70",
    bgClass: "bg-red-500/10",
    textClass: "text-red-400",
  },
  warning: {
    label: "Warning",
    borderClass: "border-amber-500/60",
    bgClass: "bg-amber-500/10",
    textClass: "text-amber-400",
  },
  info: {
    label: "Info",
    borderClass: "border-[var(--theme-border-primary)]",
    bgClass: "bg-[var(--theme-bg-secondary)]",
    textClass: "text-[var(--theme-text-primary)]",
  },
};

export function AlertBanner({
  tone = "info",
  title,
  message,
  onDismiss,
  className,
  accent,
}: AlertBannerProps) {
  const base = toneStyles[tone];
  const label = title ?? accent?.label ?? base.label;
  const borderClass = accent?.borderClass ?? base.borderClass;
  const bgClass = accent?.bgClass ?? base.bgClass;
  const textClass = accent?.textClass ?? base.textClass;

  return (
    <div
      role="status"
      className={`flex items-start justify-between gap-4 p-4 rounded-md border ${borderClass} ${bgClass} ${className ?? ""}`}
    >
      <div className="flex-1">
        <p className={`text-sm font-semibold ${textClass}`}>{label}</p>
        <p className="text-sm text-[var(--theme-text-secondary)]">
          {message}
        </p>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--theme-border-secondary)] rounded"
          aria-label="Dismiss notification"
        >
          <svg
            aria-hidden="true"
            focusable="false"
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

export type { AlertTone, AlertBannerProps };
