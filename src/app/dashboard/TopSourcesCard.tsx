import React, { useReducer } from "react";
import { tabReducer, initialTabState, type TabState } from "./tabReducer";

interface TopSourcesCardProps {
  topSourcesData: any[];
  referrersData: any;
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

const TopSourcesCard = React.memo(function TopSourcesCard({
  topSourcesData,
  referrersData,
}: TopSourcesCardProps) {
  const [tabState, dispatch] = useReducer(tabReducer, initialTabState);

  const handleTabClick = (tab: string) => {
    dispatch({
      type: "SET_TOP_SOURCES_TAB",
      payload: tab as "Sources" | "Referrers",
    });
  };

  return (
    <div className="bg-[var(--theme-card-bg)] rounded-lg p-6">
      <h3 className="text-xl font-semibold text-[var(--theme-text-primary)] mb-3">
        Top Sources
      </h3>
      <CardTabs
        tabs={["Sources", "Referrers"]}
        activeTab={tabState.topSourcesTab}
        onTabClick={handleTabClick}
      />
      <ul className="space-y-3">
        {tabState.topSourcesTab === "Sources"
          ? (topSourcesData || []).map((source: any) => (
              <li
                key={source.name}
                className="flex items-center justify-between py-2 border-b border-[var(--theme-border-primary)] last:border-b-0"
              >
                <div className="flex items-center">
                  <span
                    className={`w-4 h-4 rounded-full mr-3 ${
                      source.name === "Google"
                        ? "bg-red-500"
                        : source.name === "Direct"
                          ? "bg-blue-500"
                          : source.name === "Facebook"
                            ? "bg-gray-500"
                            : "bg-green-500"
                    }`}
                  ></span>
                  <span className="text-sm text-[var(--theme-text-primary)]">
                    {source.name}
                  </span>
                </div>
                <span className="text-sm text-[var(--theme-text-primary)] font-medium">
                  {source.visitors.toLocaleString()}
                </span>
              </li>
            ))
          : (referrersData?.data || []).map((referrer: any) => (
              <li
                key={referrer.id}
                className="flex items-center justify-between py-2 border-b border-[var(--theme-border-primary)] last:border-b-0"
              >
                <div className="flex items-center">
                  <span
                    className={`w-4 h-4 rounded-full mr-3 ${
                      referrer.id === "Google"
                        ? "bg-red-500"
                        : referrer.id === "Direct"
                          ? "bg-blue-500"
                          : referrer.id === "Facebook"
                            ? "bg-gray-500"
                            : "bg-green-500"
                    }`}
                  ></span>
                  <span className="text-sm text-[var(--theme-text-primary)]">
                    {referrer.id}
                  </span>
                </div>
                <span className="text-sm text-[var(--theme-text-primary)] font-medium">
                  {referrer.value.toLocaleString()}
                </span>
              </li>
            ))}
      </ul>
    </div>
  );
});

export default TopSourcesCard;
