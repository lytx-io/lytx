import React, { useReducer } from "react";
import { tabReducer, initialTabState } from "./tabReducer";

interface DevicesCardProps {
  browserData: any[];
  osData: any[];
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

const DevicesCard = React.memo(function DevicesCard({
  browserData,
  osData,
}: DevicesCardProps) {
  const [tabState, dispatch] = useReducer(tabReducer, initialTabState);

  const handleTabClick = (tab: string) => {
    dispatch({
      type: "SET_DEVICES_TAB",
      payload: tab as "Browser" | "OS",
    });
  };

  return (
    <div className="bg-[var(--theme-card-bg)] rounded-lg p-6">
      <h3 className="text-xl font-semibold text-[var(--theme-text-primary)] mb-3">
        Devices
      </h3>
      <CardTabs
        tabs={["Browser", "OS"]}
        activeTab={tabState.devicesTab}
        onTabClick={handleTabClick}
      />
      <ul className="space-y-3 pt-4">
        {(tabState.devicesTab === "Browser"
          ? browserData || []
          : osData || []
        ).map((device: any) => (
          <li
            key={device.name}
            className="flex items-center justify-between py-2 border-b border-[var(--theme-border-primary)] last:border-b-0"
          >
            <div className="flex items-center">
              <span
                className={`w-4 h-4 rounded-full mr-3 ${
                  tabState.devicesTab === "Browser"
                    ? device.name === "Chrome"
                      ? "bg-yellow-500"
                      : device.name === "Firefox"
                        ? "bg-orange-500"
                        : device.name === "Safari"
                          ? "bg-blue-500"
                          : "bg-gray-500"
                    : device.name === "Windows"
                      ? "bg-blue-500"
                      : device.name === "macOS"
                        ? "bg-gray-500"
                        : device.name === "Linux"
                          ? "bg-orange-500"
                          : "bg-green-500"
                }`}
              ></span>
              <span className="text-sm text-[var(--theme-text-primary)]">
                {device.name}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-[var(--theme-text-primary)] font-medium">
                {device.visitors.toLocaleString()}
              </span>
              <span className="text-xs text-[var(--theme-text-secondary)]">
                ({device.percentage})
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
});

export default DevicesCard;
