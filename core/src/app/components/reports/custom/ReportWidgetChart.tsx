"use client";

import { ResponsiveBar } from "@nivo/bar";
import { ResponsiveLine } from "@nivo/line";
import { ResponsivePie } from "@nivo/pie";
import { ResponsiveFunnel } from "@nivo/funnel";
import { ResponsiveSankey } from "@nivo/sankey";
import { useTheme } from "@/app/providers/ThemeProvider";
import { createChartTheme } from "@/app/utils/chartThemes";
import { reportColorPalettes } from "@/app/components/reports/custom/chartPalettes";
import type { CustomReportWidgetConfig } from "@/app/components/reports/custom/types";

type ReportWidgetChartProps = {
  widget: CustomReportWidgetConfig;
  rows: Array<Record<string, unknown>>;
  height?: number;
};

const toNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

export function ReportWidgetChart({ widget, rows, height = 280 }: ReportWidgetChartProps) {
  const { theme } = useTheme();
  const chartTheme = createChartTheme(theme === "dark");
  const palette = reportColorPalettes[widget.colorPalette];
  const legendTextColor = theme === "dark" ? "#ffffff" : "#4b5563";

  const categoryRows = rows.map((row) => ({
    x: String(row.x ?? row.label ?? "Unknown"),
    y: toNumber(row.y ?? row.value ?? 0),
  }));

  if (widget.chartType === "line") {
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
          margin={{ top: 20, right: 24, bottom: 44, left: 56 }}
          padding={0.3}
          colors={palette}
          valueScale={{ type: "linear" }}
          indexScale={{ type: "band", round: true }}
          yScale={{ type: "linear", min: 0, max: "auto" }}
          theme={chartTheme}
          axisBottom={{ tickRotation: -20 }}
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
    const data = categoryRows.map((item) => ({ id: item.x || "Unknown", value: item.y, label: item.x || "Unknown" }));

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

  const links = rows
    .map((row) => ({
      source: String(row.source ?? "Unknown"),
      target: String(row.target ?? "Unknown"),
      value: toNumber(row.value ?? 0),
    }))
    .filter((link) => link.value > 0);

  const nodeSet = new Set<string>();
  links.forEach((link) => {
    nodeSet.add(link.source);
    nodeSet.add(link.target);
  });

  const sankeyData = {
    nodes: Array.from(nodeSet).map((id) => ({ id })),
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
