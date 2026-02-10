"use client";

import { ResponsiveSankey } from "@nivo/sankey";
import { DashboardCard } from "@components/DashboardCard";
import { useTheme } from "@/app/providers/ThemeProvider";

import { createChartTheme, chartColors } from "@/app/utils/chartThemes";
import { useMediaQuery } from "@/app/utils/media";
import {
  type EventTypeDistributionItem,
  type TableComponentProps,
  getEventTypesDistribution,
} from "@db/tranformReports";

type SankeyFlowsProps = TableComponentProps & { labelsMap?: Map<string, string> };


export const SankeyFlows = ({
  tableId,
  tableData,
  title,
  labelsMap,
}: SankeyFlowsProps) => {
  const displayTitle = title || "Event Types Sankey";
  const rows = tableData?.rows || [];
  const { theme } = useTheme();
  const chartTheme = createChartTheme(theme === "dark");
  const isSmallScreen = useMediaQuery("(max-width: 640px)");
  const sankeyItems = getEventTypesDistribution(rows, labelsMap);

  const nodes = [{ id: "All Events" }, ...sankeyItems.map((item: EventTypeDistributionItem) => ({ id: item.label }))];
  const links = sankeyItems.map((item: EventTypeDistributionItem) => ({
    source: "All Events",
    target: item.label,
    value: item.value,
  }));

  const isEmpty = !tableData || rows.length === 0 || sankeyItems.length === 0;

  return (
    <DashboardCard id={tableId} title={displayTitle} className="mb-6" empty={isEmpty}>
      <div className="h-90 w-full">
        <ResponsiveSankey
          data={{ nodes, links }}
          margin={
            isSmallScreen
              ? { top: 20, right: 100, bottom: 20, left: 76 }
              : { top: 20, right: 180, bottom: 20, left: 120 }
          }
          align="justify"
          colors={chartColors.funnel}
          nodeOpacity={1}
          nodeThickness={isSmallScreen ? 14 : 18}
          nodeSpacing={isSmallScreen ? 18 : 24}
          nodeBorderWidth={1}
          nodeBorderColor={{ from: "color", modifiers: [["darker", 0.3]] }}
          linkOpacity={0.45}
          linkHoverOthersOpacity={0.1}
          enableLinkGradient={true}
          labelPosition="outside"
          labelOrientation="horizontal"
          labelPadding={12}
          labelTextColor={theme === "dark" ? "#ffffff" : "#111827"}
          valueFormat={(v) => `${v}%`}
          theme={chartTheme}
        />
      </div>
    </DashboardCard>
  );
};

export default SankeyFlows;
