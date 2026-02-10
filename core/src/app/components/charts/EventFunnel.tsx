import { useTheme } from "@/app/providers/ThemeProvider";
import { chartColors, createChartTheme } from "@/app/utils/chartThemes";
import { getEventTypesDistribution, TableComponentProps } from "@db/tranformReports";
import DashboardCard from "../DashboardCard";
import { ResponsiveFunnel } from "@nivo/funnel";

export const EventTypesFunnel = ({
  tableId,
  tableData,
  title,
  labelsMap,
}: TableComponentProps & { labelsMap?: Map<string, string> }) => {
  const displayTitle = title || tableData?.title || "Event Types";
  const rows = tableData?.rows || [];
  const { theme } = useTheme();
  const chartTheme = createChartTheme(theme === "dark");
  const funnelData = getEventTypesDistribution(rows, labelsMap);

  const isEmpty = !tableData || rows.length === 0 || funnelData.length === 0;

  return (
    <DashboardCard id={tableId} title={displayTitle} className="mb-6" empty={isEmpty}>
      <div className="h-90 w-full">
        <ResponsiveFunnel
          data={funnelData}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
          valueFormat={(v) => `${v}%`}
          colors={chartColors.funnel}
          interpolation="smooth"
          shapeBlending={0.9}
          borderWidth={10}
          borderOpacity={0.6}
          labelColor={theme === "dark" ? "#ffffff" : "#111827"}
          beforeSeparatorLength={90}
          beforeSeparatorOffset={16}
          afterSeparatorLength={90}
          afterSeparatorOffset={16}
          currentPartSizeExtension={8}
          currentBorderWidth={20}
          theme={chartTheme}
        />
      </div>
    </DashboardCard>
  );
};
