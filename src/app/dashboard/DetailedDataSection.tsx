import React from "react";
import { type TableComponentProps } from "@db/tranformReports";

interface DetailedDataSectionProps {
  eventTypesData: any;
  deviceGeoData: any;
  TableComponent: React.FC<TableComponentProps>;
}

const DetailedDataSection = React.memo(function DetailedDataSection({
  eventTypesData,
  deviceGeoData,
  TableComponent,
}: DetailedDataSectionProps) {
  return (
    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-6 text-[var(--theme-text-primary)]">
        Other Detailed Data
      </h2>
      {(() => {
        const eventTypesTableData = eventTypesData;
        if (eventTypesTableData) {
          return (
            <TableComponent
              tableId="eventTypesTable"
              tableData={eventTypesTableData}
            />
          );
        }
        return null;
      })()}

      {(() => {
        const deviceGeoTableData = deviceGeoData?.tableData;
        if (deviceGeoTableData) {
          return (
            <div className="mt-6">
              <TableComponent
                tableId="deviceGeoTable"
                tableData={deviceGeoTableData}
              />
            </div>
          );
        }
        return null;
      })()}
    </section>
  );
});

export default DetailedDataSection;
