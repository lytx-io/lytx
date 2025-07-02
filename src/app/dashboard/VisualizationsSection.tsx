import React from "react";
import { type ChartComponentProps } from "@db/tranformReports";

interface VisualizationsSectionProps {
  pageViewsData: any;
  referrersData: any;
  deviceGeoData: any;
  ChartComponent: React.FC<ChartComponentProps>;
}

const VisualizationsSection = React.memo(function VisualizationsSection({
  pageViewsData,
  referrersData,
  deviceGeoData,
  ChartComponent,
}: VisualizationsSectionProps) {
  return (
    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-6 text-[var(--theme-text-primary)]">
        Key Metrics Visualized
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Page Views Chart - takes full width on small, half on large */}
        <div className="lg:col-span-2">
          <ChartComponent
            chartId="pageViewsChart"
            chartData={pageViewsData}
            title="Page Views"
          />
        </div>
        {/* Referrers Chart */}
        <ChartComponent
          chartId="referrersChart"
          chartData={referrersData}
          title="Referrers"
        />
        {/* Device Types Chart - part of deviceGeoData */}
        {deviceGeoData && (
          <ChartComponent
            chartId="deviceTypesChart"
            chartData={deviceGeoData.deviceTypes}
            title="Device Types"
          />
        )}
      </div>
    </section>
  );
});

export default VisualizationsSection;
