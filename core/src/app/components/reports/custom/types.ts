export type ReportChartType = "bar" | "line" | "pie" | "funnel" | "sankey";

export type ReportAggregation = "count" | "unique_users" | "sum" | "avg";

export type ReportColorPalette = "primary" | "secondary" | "mixed" | "line" | "funnel";

export type ReportWidgetLayout = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type CustomReportWidgetConfig = {
  id: string;
  title: string;
  chartType: ReportChartType;
  xField: string;
  yField: string;
  aggregation: ReportAggregation;
  sourceField: string;
  targetField: string;
  colorPalette: ReportColorPalette;
  limit: number;
  layout: ReportWidgetLayout;
};

export type CustomReportConfig = {
  version: 1;
  widgets: CustomReportWidgetConfig[];
};

export type CustomReportRecord = {
  uuid: string;
  site_id: number;
  team_id: number;
  name: string;
  description: string | null;
  config: CustomReportConfig;
};

export type SiteEventsSchemaColumn = {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue: string | null;
};
