import React, { useReducer } from "react";
import { tabReducer, initialTabState } from "./tabReducer";

interface LocationsCardProps {
  worldMapFeatures: any[] | null;
  citiesData: any[];
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

const LocationsCard = React.memo(function LocationsCard({
  worldMapFeatures,
  citiesData,
}: LocationsCardProps) {
  const [tabState, dispatch] = useReducer(tabReducer, initialTabState);

  const handleTabClick = (tab: string) => {
    dispatch({
      type: "SET_LOCATIONS_TAB",
      payload: tab as "Countries" | "Cities",
    });
  };

  return (
    <div className="bg-[var(--theme-card-bg)] rounded-lg p-6">
      <h3 className="text-xl font-semibold text-[var(--theme-text-primary)] mb-3">
        Locations
      </h3>
      <CardTabs
        tabs={["Countries", "Cities"]}
        activeTab={tabState.locationsTab}
        onTabClick={handleTabClick}
      />
      <div style={{ height: "300px" }}>
        {tabState.locationsTab === "Countries" ? (
          !worldMapFeatures ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-[var(--theme-text-secondary)]">
                Loading map data...
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[var(--theme-text-secondary)]">
                No location data available
              </p>
            </div>
          )
        ) : (
          <ul className="space-y-3 pt-4 overflow-y-auto max-h-[260px]">
            {(citiesData || []).map(([city, details]) => (
              <li
                key={city}
                className="flex items-center justify-between py-2 border-b border-[var(--theme-border-primary)] last:border-b-0"
              >
                <div className="flex items-center">
                  <span className="w-4 h-4 rounded-full mr-3 bg-blue-500"></span>
                  <div className="flex flex-col">
                    <span className="text-sm text-[var(--theme-text-primary)]">
                      {city}
                    </span>
                    <span className="text-xs text-[var(--theme-text-secondary)]">
                      {details.country}
                    </span>
                  </div>
                </div>
                <span className="text-sm text-[var(--theme-text-primary)] font-medium">
                  {details.visitors.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
});

export default LocationsCard;
