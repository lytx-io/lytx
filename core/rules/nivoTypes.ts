export type BarDatum = Record<string, string | number>;

export type ComputedDatum<D extends BarDatum> = {
  id: string | number;
  value: number | null;
  formattedValue: string;
  hidden: boolean;
  index: number;
  indexValue: string | number;
  data: D;
  fill?: string;
};

export type BarSvgProps<D extends BarDatum> = Record<string, unknown> & {
  data: readonly D[];
};

export type ResponsiveBarSvgProps<D extends BarDatum> = BarSvgProps<D>;
export type BarCanvasProps<D extends BarDatum> = BarSvgProps<D>;
export type ResponsiveBarCanvasProps<D extends BarDatum> = BarCanvasProps<D>;
