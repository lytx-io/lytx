import React, { useReducer } from "react";
import { ResponsiveBar } from "@nivo/bar";
import { tabReducer, initialTabState } from "./tabReducer";
import { createChartTheme, chartColors } from "./utils/chartThemes";

interface TopPagesCardProps {
  topPagesData: any;
  exitPagesData: any;
}

const CardTabs: React.FC<{
  tabs: string[];
  activeTab: string;
  onTabClick: (tab: string) => void;
}> = ({ tabs, activeTab, onTabClick }) => (
  <div className="flex border-b border-[var(--theme-border-primary)] mb-4">
    {tabs.map((tab) => (
      <button
        key={tab}
        onClick={() => onTabClick(tab)}
        className={`py-2 px-4 font-semibold ${
          activeTab === tab
            ? "text-[var(--theme-text-primary)] border-b-2 border-[var(--theme-border-primary)]"
            : "text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]"
        }`}
      >
        {tab}
      </button>
    ))}
  </div>
);

const TopPagesCard = React.memo(function TopPagesCard({
  topPagesData,
  exitPagesData,
}: TopPagesCardProps) {
  const [tabState, dispatch] = useReducer(tabReducer, initialTabState);
  const chartTheme = createChartTheme(true);

  const handleTabClick = (tab: string) => {
    dispatch({
      type: "SET_TOP_PAGES_TAB",
      payload: tab as "By Views" | "By Exits",
    });
  };

  return (
    <div className="bg-[var(--theme-card-bg)] rounded-lg p-6">
      <h3 className="text-xl font-semibold text-[var(--theme-text-primary)] mb-3">
        Top Pages
      </h3>
      <CardTabs
        tabs={["By Views", "By Exits"]}
        activeTab={tabState.topPagesTab}
        onTabClick={handleTabClick}
      />
      <div style={{ height: "250px" }}>
        <ResponsiveBar
          data={
            tabState.topPagesTab === "By Views"
              ? topPagesData?.data || []
              : exitPagesData?.data || []
          }
          keys={
            tabState.topPagesTab === "By Views"
              ? topPagesData?.keys || []
              : exitPagesData?.keys || []
          }
          indexBy={
            tabState.topPagesTab === "By Views"
              ? topPagesData?.indexBy || "page"
              : exitPagesData?.indexBy || "page"
          }
          layout="horizontal"
          margin={{ top: 10, right: 10, bottom: 20, left: 120 }}
          padding={0.3}
          valueScale={{ type: "linear" }}
          indexScale={{ type: "band", round: true }}
          colors={chartColors.primary}
          borderColor={{
            from: "color",
            modifiers: [["darker", 1.6]],
          }}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
          }}
          labelSkipWidth={12}
          labelSkipHeight={12}
          labelTextColor={{
            from: "color",
            modifiers: [["darker", 1.6]],
          }}
          theme={chartTheme}
          animate={true}
          motionConfig="gentle"
        />
      </div>
    </div>
  );
});

export default TopPagesCard;
