import type { CustomReportWidgetConfig } from "@/app/components/reports/custom/types";

export type WidgetQueryFilters = {
  dateRange?: {
    start: string;
    end: string;
  };
  deviceType?: string;
  country?: string;
  city?: string;
  region?: string;
  source?: string;
  pageUrl?: string;
  eventName?: string;
};

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

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const escapeSqlLiteral = (value: string) => value.replace(/'/g, "''");

const buildWhereClauses = (filters?: WidgetQueryFilters) => {
  if (!filters) return [] as string[];

  const clauses: string[] = [];
  const start = filters.dateRange?.start;
  const end = filters.dateRange?.end;

  if (start && end && DATE_ONLY_PATTERN.test(start) && DATE_ONLY_PATTERN.test(end)) {
    clauses.push(
      `created_at >= CAST(strftime('%s', '${escapeSqlLiteral(start)} 00:00:00') AS INTEGER)`,
    );
    clauses.push(
      `created_at <= CAST(strftime('%s', '${escapeSqlLiteral(end)} 23:59:59') AS INTEGER)`,
    );
  }

  if (filters.deviceType) {
    clauses.push(`COALESCE(CAST("device_type" AS TEXT), '') = '${escapeSqlLiteral(filters.deviceType)}'`);
  }
  if (filters.country) {
    clauses.push(`COALESCE(CAST("country" AS TEXT), '') = '${escapeSqlLiteral(filters.country)}'`);
  }
  if (filters.city) {
    clauses.push(`COALESCE(CAST("city" AS TEXT), '') = '${escapeSqlLiteral(filters.city)}'`);
  }
  if (filters.region) {
    clauses.push(`COALESCE(CAST("region" AS TEXT), '') = '${escapeSqlLiteral(filters.region)}'`);
  }
  if (filters.source) {
    clauses.push(`COALESCE(CAST("referer" AS TEXT), '') = '${escapeSqlLiteral(filters.source)}'`);
  }
  if (filters.pageUrl) {
    clauses.push(
      `COALESCE(CAST("client_page_url" AS TEXT), CAST("page_url" AS TEXT), '') = '${escapeSqlLiteral(filters.pageUrl)}'`,
    );
  }
  if (filters.eventName) {
    clauses.push(`COALESCE(CAST("event" AS TEXT), '') = '${escapeSqlLiteral(filters.eventName)}'`);
  }

  return clauses;
};

export function buildSqlForWidget(
  widget: CustomReportWidgetConfig,
  availableColumns: string[],
  filters?: WidgetQueryFilters,
) {
  const allowedColumns = new Set(availableColumns);
  const limit = clampLimit(widget.limit);
  const metricExpression = getMetricExpression(widget, allowedColumns);
  const whereClauses = buildWhereClauses(filters);
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  if (widget.chartType === "sankey") {
    const sourceField = sanitizeIdentifier(widget.sourceField, allowedColumns);
    const targetField = sanitizeIdentifier(widget.targetField, allowedColumns);

    return [
      `SELECT COALESCE(CAST(${sourceField} AS TEXT), 'Unknown') AS source,`,
      `COALESCE(CAST(${targetField} AS TEXT), 'Unknown') AS target,`,
      `${metricExpression} AS value`,
      "FROM site_events",
      whereSql,
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
      whereSql,
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
    whereSql,
    "GROUP BY 1",
    "ORDER BY y DESC",
    `LIMIT ${limit}`,
  ].join(" ");
}
