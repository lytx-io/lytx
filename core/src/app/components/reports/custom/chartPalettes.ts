import { chartColors } from "@/app/utils/chartThemes";
import type { ReportColorPalette } from "@/app/components/reports/custom/types";

export const reportColorPalettes: Record<ReportColorPalette, string[]> = {
  primary: chartColors.primary,
  secondary: chartColors.secondary,
  mixed: chartColors.mixed,
  line: chartColors.line,
  funnel: chartColors.funnel,
};

export const reportPaletteOptions: Array<{ value: ReportColorPalette; label: string }> = [
  { value: "primary", label: "Brand Primary" },
  { value: "secondary", label: "Brand Secondary" },
  { value: "mixed", label: "Brand Blend" },
  { value: "line", label: "Brand Focus" },
  { value: "funnel", label: "Brand Warm" },
];
