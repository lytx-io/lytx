import type { CustomReportWidgetConfig } from "@/app/components/reports/custom/types";

const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const clampLimit = (value: number) => {
  if (!Number.isFinite(value)) return 25;
  return Math.min(Math.max(Math.floor(value), 1), 500);
};

const sanitizeIdentifier = (value: string, allowedColumns: Set<string>) => {
  if (!SAFE_IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`Invalid field name: ${value}`);
  }
  if (!allowedColumns.has(value)) {
    throw new Error(`Field is not available in site_events: ${value}`);
  }
  return `"${value}"`;
};

const getMetricExpression = (
  widget: CustomReportWidgetConfig,
  allowedColumns: Set<string>,
) => {
  if (widget.aggregation === "count") {
    return "COUNT(*)";
  }

  if (widget.aggregation === "unique_users") {
    return "COUNT(DISTINCT rid)";
  }

  const yField = sanitizeIdentifier(widget.yField, allowedColumns);
  if (widget.aggregation === "sum") {
    return `SUM(COALESCE(CAST(${yField} AS REAL), 0))`;
  }

  return `AVG(COALESCE(CAST(${yField} AS REAL), 0))`;
};

export function buildSqlForWidget(
  widget: CustomReportWidgetConfig,
  availableColumns: string[],
) {
  const allowedColumns = new Set(availableColumns);
  const limit = clampLimit(widget.limit);
  const metricExpression = getMetricExpression(widget, allowedColumns);

  if (widget.chartType === "sankey") {
    const sourceField = sanitizeIdentifier(widget.sourceField, allowedColumns);
    const targetField = sanitizeIdentifier(widget.targetField, allowedColumns);

    return [
      `SELECT COALESCE(CAST(${sourceField} AS TEXT), 'Unknown') AS source,`,
      `COALESCE(CAST(${targetField} AS TEXT), 'Unknown') AS target,`,
      `${metricExpression} AS value`,
      "FROM site_events",
      "GROUP BY 1, 2",
      "ORDER BY value DESC",
      `LIMIT ${limit}`,
    ].join(" ");
  }

  if (widget.xField === "created_at") {
    return [
      "SELECT strftime('%Y-%m-%d', created_at, 'unixepoch') AS x,",
      `${metricExpression} AS y`,
      "FROM site_events",
      "GROUP BY 1",
      "ORDER BY 1 ASC",
      `LIMIT ${limit}`,
    ].join(" ");
  }

  const xField = sanitizeIdentifier(widget.xField, allowedColumns);

  return [
    `SELECT COALESCE(CAST(${xField} AS TEXT), 'Unknown') AS x,`,
    `${metricExpression} AS y`,
    "FROM site_events",
    "GROUP BY 1",
    "ORDER BY y DESC",
    `LIMIT ${limit}`,
  ].join(" ");
}
