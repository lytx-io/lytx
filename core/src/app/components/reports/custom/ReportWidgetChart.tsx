"use client";

import { ResponsiveBar } from "@nivo/bar";
import { ResponsiveLine } from "@nivo/line";
import { ResponsivePie } from "@nivo/pie";
import { ResponsiveFunnel } from "@nivo/funnel";
import { ResponsiveSankey } from "@nivo/sankey";
import { useTheme } from "@/app/providers/ThemeProvider";
import { createChartTheme } from "@/app/utils/chartThemes";
import { reportColorPalettes } from "@/app/components/reports/custom/chartPalettes";
import { WorldMapCard } from "@/app/components/WorldMapCard";
import type { CustomReportWidgetConfig } from "@/app/components/reports/custom/types";

type ReportWidgetChartProps = {
  widget: CustomReportWidgetConfig;
  rows: Array<Record<string, unknown>>;
  height?: number;
  labelsMap?: Map<string, string>;
};

const toNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const truncateAxisLabel = (value: unknown, max = 20) => {
  const label = String(value ?? "").trim();
  if (label.length <= max) return label;
  return `${label.slice(0, max - 3)}...`;
};

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const isValidHexColor = (value: unknown): value is string =>
  typeof value === "string" && HEX_COLOR_PATTERN.test(value.trim());

const hasDirectedCycle = (nodes: string[], links: Array<{ source: string; target: string }>) => {
  const adjacency = new Map<string, string[]>();
  nodes.forEach((node) => adjacency.set(node, []));

  for (const link of links) {
    const sourceTargets = adjacency.get(link.source);
    if (sourceTargets) {
      sourceTargets.push(link.target);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const dfs = (node: string): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;

    visiting.add(node);
    const targets = adjacency.get(node) ?? [];
    for (const target of targets) {
      if (dfs(target)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };

  for (const node of nodes) {
    if (dfs(node)) return true;
  }

  return false;
};

const getAutocaptureDisplayName = (eventName: string): string => {
  if (!eventName.startsWith("$ac_")) return eventName;

  const parts = eventName.split("_");
  const elementText = parts[2] || "unnamed";
  const elementId = parts[3] || null;

  return elementId ? `${elementText}_${elementId}` : elementText;
};

export function ReportWidgetChart({ widget, rows, height = 280, labelsMap }: ReportWidgetChartProps) {
  const { theme } = useTheme();
  const chartTheme = createChartTheme(theme === "dark");
  const basePalette = reportColorPalettes[widget.colorPalette];
  const customPalette = [widget.customPrimaryColor, widget.customSecondaryColor]
    .filter(isValidHexColor)
    .map((color) => color.trim());
  const palette = customPalette.length > 0
    ? [...customPalette, ...basePalette]
    : basePalette;
  const legendTextColor = theme === "dark" ? "#ffffff" : "#4b5563";

  const mapEventLabel = (value: unknown, fieldName: string) => {
    const text = String(value ?? "Unknown");
    if (fieldName !== "event") return text;
    return labelsMap?.get(text) || getAutocaptureDisplayName(text);
  };

  const categoryRows = rows.map((row) => ({
    x: mapEventLabel(row.x ?? row.label ?? "Unknown", widget.xField),
    y: toNumber(row.y ?? row.value ?? 0),
  }));

  if (widget.chartType === "line") {
    if (categoryRows.length < 2) {
      return (
        <div style={{ height }} className="flex items-center justify-center text-sm text-(--theme-text-secondary)">
          Need at least 2 points to render a line chart.
        </div>
      );
    }

    const data = [
      {
        id: widget.title || widget.id,
        data: categoryRows.map((item) => ({ x: item.x, y: item.y })),
      },
    ];

    return (
      <div style={{ height }}>
        <ResponsiveLine
          data={data}
          margin={{ top: 20, right: 24, bottom: 44, left: 56 }}
          xScale={{ type: "point" }}
          yScale={{ type: "linear", min: 0, max: "auto", stacked: false, reverse: false }}
          pointSize={8}
          pointBorderWidth={2}
          pointLabelYOffset={-12}
          enableArea
          areaOpacity={0.2}
          useMesh
          colors={palette}
          theme={chartTheme}
        />
      </div>
    );
  }

  if (widget.chartType === "bar") {
    const data = categoryRows.map((item) => ({ x: item.x, y: item.y }));
    return (
      <div style={{ height }}>
        <ResponsiveBar
          data={data}
          keys={["y"]}
          indexBy="x"
          margin={{ top: 20, right: 24, bottom: 56, left: 72 }}
          padding={0.3}
          colors={palette}
          valueScale={{ type: "linear" }}
          indexScale={{ type: "band", round: true }}
          theme={chartTheme}
          axisBottom={{
            tickRotation: -20,
            tickPadding: 14,
            format: (value) => truncateAxisLabel(value),
          }}
        />
      </div>
    );
  }

  if (widget.chartType === "pie") {
    const data = categoryRows.map((item) => ({ id: item.x || "Unknown", label: item.x || "Unknown", value: item.y }));

    return (
      <div style={{ height }}>
        <ResponsivePie
          data={data}
          margin={{ top: 20, right: 24, bottom: 44, left: 24 }}
          innerRadius={0.5}
          padAngle={0.7}
          cornerRadius={3}
          activeOuterRadiusOffset={8}
          colors={palette}
          theme={chartTheme}
          legends={[
            {
              anchor: "bottom",
              direction: "row",
              justify: false,
              translateY: 36,
              itemWidth: 90,
              itemHeight: 18,
              itemsSpacing: 4,
              symbolSize: 12,
              symbolShape: "circle",
              itemTextColor: legendTextColor,
            },
          ]}
        />
      </div>
    );
  }

  if (widget.chartType === "funnel") {
    const data = categoryRows
      .map((item) => ({ id: item.x || "Unknown", value: item.y, label: item.x || "Unknown" }))
      .filter((item) => item.value > 0);

    if (data.length < 2) {
      return (
        <div style={{ height }} className="flex items-center justify-center text-sm text-(--theme-text-secondary)">
          Need at least 2 funnel steps with values.
        </div>
      );
    }

    return (
      <div style={{ height }}>
        <ResponsiveFunnel
          data={data}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
          interpolation="smooth"
          shapeBlending={0.9}
          colors={palette}
          theme={chartTheme}
        />
      </div>
    );
  }

  if (widget.chartType === "map") {
    const aggregatedCountries = categoryRows
      .map((item) => [item.x.trim().toUpperCase(), item.y] as [string, number])
      .filter(([countryCode, value]) => countryCode.length > 0 && value > 0);

    return (
      <WorldMapCard
        aggregatedCountries={aggregatedCountries}
        isDark={theme === "dark"}
        metricLabel="events"
        height={height}
        embedded
      />
    );
  }

  const links = rows
    .map((row) => ({
      source: mapEventLabel(row.source ?? "Unknown", widget.sourceField),
      target: mapEventLabel(row.target ?? "Unknown", widget.targetField),
      value: toNumber(row.value ?? 0),
    }))
    .filter((link) => link.value > 0)
    .filter((link) => link.source.trim().length > 0 && link.target.trim().length > 0)
    .filter((link) => link.source !== link.target);

  const nodeSet = new Set<string>();
  links.forEach((link) => {
    nodeSet.add(link.source);
    nodeSet.add(link.target);
  });

  const nodes = Array.from(nodeSet);

  if (nodes.length < 2 || links.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-sm text-(--theme-text-secondary)">
        Need at least 2 connected nodes for sankey.
      </div>
    );
  }

  if (hasDirectedCycle(nodes, links)) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-sm text-(--theme-text-secondary)">
        Sankey requires an acyclic flow graph.
      </div>
    );
  }

  const sankeyData = {
    nodes: nodes.map((id) => ({ id })),
    links,
  };

  return (
    <div style={{ height }}>
      <ResponsiveSankey
        data={sankeyData}
        margin={{ top: 20, right: 24, bottom: 20, left: 24 }}
        nodeOpacity={1}
        nodeHoverOthersOpacity={0.35}
        nodeThickness={14}
        nodeSpacing={16}
        nodeBorderWidth={0}
        linkOpacity={0.4}
        colors={palette}
        theme={chartTheme}
        labelTextColor={legendTextColor}
      />
    </div>
  );
}
