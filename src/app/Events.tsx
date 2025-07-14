"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type CellContext,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
} from "@tanstack/react-table";

import type { pageEvent } from "@/templates/lytxpixel";
import { EventForm, type EventFieldDefinition } from "@components/EventForm";
import { EditableCell } from "@components/EditableCell";

const debug = false;

type UIEvent = pageEvent & {
  local_id: string;
};

export type paramConfig = Array<{
  param: string;
  value: string;
}>;

// Updated TableMeta interface
// For server-side operations, this meta might also include setters for server-side states if needed.
interface TableMeta {
  updateCellData: (
    localId: string,
    columnId: keyof pageEvent,
    value: any,
  ) => void;
  commitCellEdit: () => void;
  startCellEdit: (eventId: string, columnId: keyof pageEvent) => void; // Changed columnId type
  eventFields: EventFieldDefinition[];
  editingCell: { eventId: string; columnId: keyof pageEvent } | null; // Changed columnId type
  editingEventId: string | null;
}

const createLocalId = () =>
  `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// If server-side, this function would accept sorting, filters, pagination states
// and pass them to the API call.
// const fetchEventsReactQuery = async (
//   tagIdToFetch: string,
//   sorting: SortingState,
//   filters: ColumnFiltersState,
//   pagination: PaginationState
// ): Promise<{ rows: pageEvent[], pageCount: number }> => { // API would return rows and pageCount
//   if (!tagIdToFetch) return { rows: [], pageCount: 0 };
//   const params = new URLSearchParams();
//   params.append('pageIndex', String(pagination.pageIndex));
//   params.append('pageSize', String(pagination.pageSize));
//   params.append('sorting', JSON.stringify(sorting));
//   params.append('filters', JSON.stringify(filters));
//   const response = await fetch(`/api/events/${tagIdToFetch}?${params.toString()}`);

const fetchEventsReactQuery = async (
  tagIdToFetch: string,
): Promise<pageEvent[]> => {
  if (!tagIdToFetch) return [];
  // Current: client-side, so no extra params for sort/filter/page
  const response = await fetch(`/api/events/${tagIdToFetch}`);
  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(
      errorData || `Failed to fetch events: ${response.statusText}`,
    );
  }
  return (await response.json()) || [];
};

interface SaveEventsParams {
  tagId: string;
  eventsToSave: Omit<pageEvent, "local_id">[];
}

const saveEventsMutationFn = async ({
  tagId,
  eventsToSave,
}: SaveEventsParams) => {
  const response = await fetch(`/api/events/${tagId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(eventsToSave),
  });
  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(
      errorData || `Failed to save events: ${response.statusText}`,
    );
  }
  try {
    return await response.json();
  } catch (e) {
    return response.text();
  }
};

const columnHelper = createColumnHelper<UIEvent>();
const vendorFields: Array<keyof pageEvent> = [
  "QuantcastPixelId",
  "QuantCastPixelLabel",
  "SimplfiPixelid",
  "googleanalytics",
  "googleadsscript",
  "googleadsconversion",
  "metaEvent",
  "linkedinEvent",
  "clickCease",
];

export function EventsPage({ initialTagId = "test-tag-id" }) {
  const [events, setEvents] = useState<UIEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentTagId, setCurrentTagId] = useState(initialTagId);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  // Updated editingCell state type
  const [editingCell, setEditingCell] = useState<{
    eventId: string;
    columnId: keyof pageEvent;
  } | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);

  // State for table features
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0, //initial page index
    pageSize: 10, //default page size
  });

  const queryClient = useQueryClient();
  const tableQuery = useQuery<pageEvent[], Error>({
    // For server-side sorting/filtering/pagination, these states would be part of the queryKey:
    // queryKey: ['events', currentTagId, sorting, columnFilters, pagination],
    queryKey: ["events", currentTagId], // Current: client-side sorting/filtering/pagination
    queryFn: async () => {
      const dataFetch = await fetchEventsReactQuery(
        currentTagId,
        // If server-side, pass sorting, columnFilters, pagination to fetchEventsReactQuery:
        // sorting,
        // columnFilters,
        // pagination
      );
      //NOTE: Only want this initaiily set i dont want this run in effect..
      setEvents(
        dataFetch.map(
          (event): UIEvent => ({
            ...event,
            local_id: createLocalId(),
          }),
        ),
      );
      return dataFetch;
    },
    // If server-side, fetched data might be an object like { rows: pageEvent[], pageCount: number }
    // And `keepPreviousData` might be useful.
    enabled: !!currentTagId,
  });
  const { isLoading, error: queryError } = tableQuery;

  const {
    mutate: saveEvents,
    isPending: saving,
    error: mutationError,
  } = useMutation<unknown, Error, SaveEventsParams>({
    mutationFn: saveEventsMutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", currentTagId] });
      alert("Events saved successfully!");
      setEditingEventId(null);
      setEditingCell(null);
    },
  });

  // useEffect(() => {
  //   if (debug) console.log('Events.tsx: Fetched data sync effect fired', { fetchedEventsData, isLoading, queryError });
  //   if (fetchedEventsData) {
  //     setEvents(
  //       fetchedEventsData.map((event): UIEvent => ({
  //         ...event,
  //         local_id: createLocalId(),
  //       }))
  //     );
  //   } else if (!isLoading && !queryError) {
  //     setEvents([]);
  //   }
  // }, [fetchedEventsData, isLoading, queryError]);

  useEffect(() => {
    if (debug) console.log("Events.tsx: Mount effect fired");
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (debug)
      console.log("Events.tsx: Error display effect fired", {
        queryError,
        mutationError,
        isLoading,
        saving,
      });
    if (queryError) setError(queryError.message);
    else if (mutationError) setError(mutationError.message);
    else if (!isLoading && !saving) setError(null);
  }, [queryError, mutationError, isLoading, saving]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setShowLeftShadow(scrollLeft > 1);
      setShowRightShadow(scrollLeft < scrollWidth - clientWidth - 1);
    }
  }, []);

  // useEffect(() => {
  //   const container = scrollContainerRef.current;
  //   if (container) {
  //     handleScroll();
  //     container.addEventListener('scroll', handleScroll);
  //     const resizeObserver = new ResizeObserver(handleScroll);
  //     resizeObserver.observe(container);
  //     return () => {
  //       container.removeEventListener('scroll', handleScroll);
  //       resizeObserver.unobserve(container);
  //       resizeObserver.disconnect();
  //     };
  //   }
  // }, [handleScroll]);

  const handleEventChangeInternal = useCallback(
    (localId: string, field: keyof pageEvent, value: any) => {
      setEvents((prevEvents) =>
        prevEvents.map((event) =>
          event.local_id === localId ? { ...event, [field]: value } : event,
        ),
      );
    },
    [],
  );

  const handleDeleteEvent = useCallback((localIdToDelete: string) => {
    setEvents((prevEvents) =>
      prevEvents.filter((event) => event.local_id !== localIdToDelete),
    );
  }, []);

  // Updated handleStartCellEdit signature
  const handleStartCellEdit = useCallback(
    (eventId: string, columnId: keyof pageEvent) => {
      if (!editingEventId) {
        setEditingCell({ eventId, columnId });
      }
    },
    [editingEventId],
  );

  const handleCellCommit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const eventFields: EventFieldDefinition[] = useMemo(
    () => [
      { name: "event_name", label: "Event Name", type: "text" },
      {
        name: "condition",
        label: "Condition",
        type: "select",
        options: [
          "page_load",
          "click",
          "custom_event",
          "scroll",
          "form_submission",
          "element_visibility",
          "path",
        ],
      },
      { name: "parameters", label: "Parameters (JSON)", type: "textarea" },
      {
        name: "paramConfig",
        label: "Param Config (JSON Array)",
        type: "textarea",
      },
      {
        name: "query_parameters",
        label: "Query Parameters (JSON Array)",
        type: "textarea",
      },
      { name: "rules", label: "Rules", type: "text" },
      { name: "customScript", label: "Custom Script", type: "textarea" },
      { name: "data_passback", label: "Data Passback", type: "text" },
      { name: "Notes", label: "Notes", type: "textarea" },
      { name: "QuantcastPixelId", label: "Quantcast Pixel ID", type: "text" },
      {
        name: "QuantCastPixelLabel",
        label: "Quantcast Pixel Label",
        type: "text",
      },
      { name: "SimplfiPixelid", label: "Simplfi Pixel ID", type: "text" },
      { name: "googleanalytics", label: "Google Analytics ID", type: "text" },
      { name: "googleadsscript", label: "Google Ads Script", type: "textarea" },
      {
        name: "googleadsconversion",
        label: "Google Ads Conversion",
        type: "text",
      },
      { name: "metaEvent", label: "Meta Event ID", type: "text" },
      { name: "linkedinEvent", label: "LinkedIn Event ID", type: "text" },
      { name: "clickCease", label: "ClickCease Script", type: "textarea" },
    ],
    [],
  );

  const columns = useMemo(() => {
    // Updated createEditableCellRenderer to use meta and correct types
    const createEditableCellRenderer =
      (columnIdAsKeyOfPageEvent: keyof pageEvent) =>
        (props: CellContext<UIEvent, any>) => {
          const { table, row } = props;
          const meta = table.options.meta as TableMeta;

          const event = row.original;
          // Use columnIdAsKeyOfPageEvent for checking editingCell state
          const isCurrentlyEditing =
            meta.editingCell?.eventId === event.local_id &&
            meta.editingCell?.columnId === columnIdAsKeyOfPageEvent;
          const fieldDef = meta.eventFields.find(
            (f) => f.name === columnIdAsKeyOfPageEvent,
          );

          if (!fieldDef)
            return (
              <div>
                Error: Field definition not found for {columnIdAsKeyOfPageEvent}
              </div>
            );

          return (
            <div
              onClick={() => {
                console.log("clicking a cell");
                if (!isCurrentlyEditing && !meta.editingEventId) {
                  meta.startCellEdit(event.local_id, columnIdAsKeyOfPageEvent); // Pass keyof pageEvent
                }
              }}
              className={
                isCurrentlyEditing
                  ? ""
                  : "cursor-pointer hover:bg-[var(--theme-bg-secondary)] p-1 rounded"
              }
              style={{ minHeight: "2.5rem", width: "100%" }}
            >
              <EditableCell
                key={`${event.local_id}-${String(columnIdAsKeyOfPageEvent)}-${isCurrentlyEditing}`}
                initialValue={props.getValue()}
                isEditing={isCurrentlyEditing}
                fieldDefinition={fieldDef}
                eventId={event.local_id}
                columnId={columnIdAsKeyOfPageEvent} // Pass as keyof pageEvent
                updateData={meta.updateCellData}
                exitEditMode={meta.commitCellEdit}
              />
            </div>
          );
        };

    return [
      columnHelper.accessor("event_name", {
        header: "Event Name",
        cell: createEditableCellRenderer("event_name"),
      }),
      columnHelper.accessor("condition", {
        header: "Condition",
        cell: createEditableCellRenderer("condition"),
      }),
      columnHelper.accessor("Notes", {
        header: "Notes",
        cell: createEditableCellRenderer("Notes"),
      }),
      columnHelper.accessor("data_passback", {
        header: "Data Passback",
        cell: createEditableCellRenderer("data_passback"),
      }),
      columnHelper.accessor("parameters", {
        header: "Params",
        cell: createEditableCellRenderer("parameters"),
      }),
      columnHelper.accessor("paramConfig", {
        header: "Param Config",
        cell: (info) => (info.getValue() ? "View" : "No"),
      }),
      columnHelper.accessor("query_parameters", {
        header: "Query Params",
        cell: (info) => (info.getValue() ? "View" : "No"),
      }),
      columnHelper.accessor("customScript", {
        header: "Custom Script",
        cell: (info) => (info.getValue() ? "Yes" : "No"),
      }),
      columnHelper.accessor("rules", {
        header: "Rules",
        cell: (info) => (info.getValue() ? "View" : "No"),
      }),
      columnHelper.display({
        id: "vendor",
        header: "Vendor Configs",
        cell: (props) => {
          const event = props.row.original;
          const activeVendors = vendorFields.filter(
            (field) => event[field] && String(event[field]).trim() !== "",
          );
          const vendorNames =
            activeVendors
              .map((field) =>
                field
                  .replace(
                    /PixelId|PixelLabel|google|script|conversion|Event|analytics|ads/gi,
                    "",
                  )
                  .replace(/([A-Z])/g, " $1")
                  .trim(),
              )
              .join(", ") || "None";
          return `${activeVendors.length > 0 ? vendorNames : "N/A"} (${activeVendors.length})`;
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (props) => {
          const event = props.row.original;
          const meta = props.table.options.meta as TableMeta;
          return (
            <div className="space-x-2 whitespace-nowrap">
              <button
                onClick={() => {
                  meta.commitCellEdit();
                  setEditingEventId(event.local_id);
                }}
                disabled={
                  isLoading ||
                  saving ||
                  !!meta.editingEventId ||
                  !!meta.editingCell
                }
                className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      `Are you sure you want to delete event: "${event.event_name || "this event"}"?`,
                    )
                  ) {
                    handleDeleteEvent(event.local_id);
                  }
                }}
                disabled={
                  isLoading ||
                  saving ||
                  !!meta.editingEventId ||
                  !!meta.editingCell
                }
                className="text-[var(--color-danger)] hover:text-[var(--color-danger-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          );
        },
      }),
    ];
    // Refined Dependency Array
  }, [
    isLoading,
    saving,
    editingEventId,
    editingCell,
    handleDeleteEvent,
    setEditingEventId,
    setEditingCell,
  ]);

  const table = useReactTable({
    data: events,
    columns,
    state: {
      // Add this object
      sorting,
      columnFilters,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    // manualPagination: true, // Set to true for server-side pagination
    // manualSorting: true,    // Set to true for server-side sorting
    // manualFiltering: true,  // Set to true for server-side filtering
    // pageCount: data?.pageCount, // For server-side pagination, provide the total page count from API response
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(), // Add for filtering
    getPaginationRowModel: getPaginationRowModel(), // Add for pagination
    getRowId: (row: UIEvent) => row.local_id,
    debugTable: debug,
    debugHeaders: debug,
    debugColumns: debug,
    meta: {
      updateCellData: handleEventChangeInternal,
      commitCellEdit: handleCellCommit,
      startCellEdit: handleStartCellEdit,
      eventFields: eventFields,
      editingCell: editingCell,
      editingEventId: editingEventId,
    } as TableMeta,
  });

  const eventToEdit = editingEventId
    ? events.find((event) => event.local_id === editingEventId)
    : null;

  const handleSave = () => {
    if (!currentTagId) {
      setError("Cannot save events without a Tag ID.");
      return;
    }
    setError(null);
    setEditingCell(null);
    const eventsToSave = events.map(({ local_id, ...rest }) => rest);
    saveEvents({ tagId: currentTagId, eventsToSave });
  };

  const handleFormEventChange = useCallback(
    (fieldName: keyof pageEvent, value: any) => {
      if (!editingEventId) return;
      handleEventChangeInternal(editingEventId, fieldName, value);
    },
    [editingEventId, handleEventChangeInternal],
  );

  const handleAddEvent = useCallback(() => {
    setEditingCell(null);
    const newEventLocalId = createLocalId();
    const newEvent: UIEvent = {
      local_id: newEventLocalId,
      event_name: "Custom",
      condition: "path",
      rules: "equals",
      parameters: "{}",
      paramConfig: "[]",
      query_parameters: "[]",
      customScript: "",
      Notes: "",
      data_passback: "",
      QuantcastPixelId: "",
      QuantCastPixelLabel: "",
      SimplfiPixelid: "",
      googleanalytics: "",
      googleadsscript: "",
      googleadsconversion: "",
      metaEvent: "",
      linkedinEvent: "",
      clickCease: undefined,
      personalization: undefined,
    };
    setEvents((prevEvents) => [...prevEvents, newEvent]);
    setEditingEventId(newEventLocalId);
  }, [setEditingEventId]);

  const dynamicDisabledCondition =
    saving || isLoading || !!editingEventId || !!editingCell;

  return (
    <div className="p-6 bg-[var(--theme-bg-primary)] min-h-screen">
      <div className="max-w-6xl mx-auto bg-[var(--theme-card-bg)] shadow-xl rounded-lg p-8">
        <h1 className="text-3xl font-bold mb-6 text-[var(--theme-text-primary)]">
          Manage Events for Tag ID: {currentTagId}
        </h1>
        <div className="mb-6">
          <label
            htmlFor="tagIdInput"
            className="block text-sm font-medium text-[var(--theme-text-secondary)] mb-1"
          >
            Load Events for Tag ID:
          </label>
          <input
            type="text"
            id="tagIdInput"
            value={currentTagId}
            onChange={(e) => {
              setCurrentTagId(e.target.value);
              setEditingCell(null);
              setEditingEventId(null);
            }}
            placeholder="Enter Tag ID"
            className="flex-grow mt-1 block w-full px-3 py-2 border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] text-[var(--theme-text-primary)] rounded-md shadow-sm focus:outline-none focus:ring-0 focus:border-[var(--theme-input-border-focus)] sm:text-sm"
          />
        </div>

        {isLoading && <p className="text-blue-600 my-4">Loading events...</p>}
        {error && (
          <p className="text-red-600 p-3 my-4 bg-[var(--color-danger)] bg-opacity-10 border border-red-400 rounded">
            Error: {error}
          </p>
        )}

        {eventToEdit && (
          <div className="mb-8">
            <EventForm
              eventToEdit={eventToEdit}
              eventFields={eventFields}
              onEventChange={handleFormEventChange}
              onCancel={() => setEditingEventId(null)}
              onSubmit={() => {
                setEditingEventId(null);
              }}
            />
          </div>
        )}

        <div
          ref={scrollContainerRef}
          className="relative overflow-x-auto shadow-md rounded-lg mb-6"
        >
          {/* Left Shadow Div */}
          <div
            className={`absolute top-0 left-0 bottom-0 w-10 pointer-events-none transition-opacity duration-300 z-5 ${showLeftShadow ? "opacity-100" : "opacity-0"}`}
            style={{ boxShadow: "inset 10px 0 8px -8px rgba(0,0,0,0.15)" }}
          />

          <table className="min-w-full divide-y divide-[var(--theme-border-primary)]">
            <thead className="bg-[var(--theme-card-bg)]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    let thClasses =
                      "px-6 py-3 text-left text-xs font-medium text-[var(--theme-text-secondary)] uppercase tracking-wider";
                    if (header.id === "event_name") {
                      thClasses +=
                        " sticky left-0 bg-[var(--theme-card-bg)] z-10";
                    } else if (header.id === "actions") {
                      thClasses +=
                        " sticky right-0 bg-[var(--theme-card-bg)] z-10";
                    }
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        className={`${thClasses} ${header.column.getCanSort() ? "cursor-pointer select-none" : ""}`}
                        onClick={
                          header.column.getCanSort()
                            ? header.column.getToggleSortingHandler()
                            : undefined
                        }
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                        {{
                          asc: " 🔼",
                          desc: " 🔽",
                        }[header.column.getIsSorted() as string] ?? null}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="bg-[var(--theme-card-bg)] divide-y divide-[var(--theme-border-primary)]">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-[var(--theme-bg-secondary)]"
                >
                  {row.getVisibleCells().map((cell) => {
                    let tdClasses =
                      "px-6 py-4 whitespace-nowrap text-sm text-[var(--theme-text-primary)]";
                    if (cell.column.id === "event_name") {
                      tdClasses +=
                        " sticky left-0 bg-[var(--theme-card-bg)] z-10 hover:bg-[var(--theme-bg-secondary)]";
                    } else if (cell.column.id === "actions") {
                      tdClasses +=
                        " sticky right-0 bg-[var(--theme-card-bg)] z-10 hover:bg-[var(--theme-bg-secondary)]";
                    }
                    return (
                      <td key={cell.id} className={tdClasses}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Right Shadow Div */}
          <div
            className={`absolute top-0 right-0 bottom-0 w-10 pointer-events-none transition-opacity duration-300 z-5 ${showRightShadow ? "opacity-100" : "opacity-0"}`}
            style={{ boxShadow: "inset -10px 0 8px -8px rgba(0,0,0,0.15)" }}
          />
        </div>

        {/* Pagination UI */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-[var(--theme-text-secondary)]">
            Page{" "}
            <strong>
              {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </strong>
          </div>
          <div className="space-x-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1 text-sm font-medium text-[var(--theme-text-primary)] bg-[var(--theme-button-bg)] rounded-md border border-[var(--theme-input-border)] hover:bg-[var(--theme-button-hover)] focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1 text-sm font-medium text-[var(--theme-text-primary)] bg-[var(--theme-button-bg)] rounded-md border border-[var(--theme-input-border)] hover:bg-[var(--theme-button-hover)] focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => {
              table.setPageSize(Number(e.target.value));
            }}
            className="ml-2 px-2 py-1 text-sm text-[var(--theme-text-primary)] bg-[var(--theme-input-bg)] rounded-md border border-[var(--theme-input-border)] focus:outline-none focus:ring-0 focus:border-[var(--theme-input-border-focus)]"
          >
            {[10, 20, 30, 40, 50].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                Show {pageSize}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 flex space-x-4">
          <button
            onClick={handleAddEvent}
            className="px-4 py-2 bg-[var(--color-secondary)] text-white font-semibold rounded-md shadow-sm hover:bg-[var(--color-secondary-hover)] focus:outline-none focus:ring-0 disabled:opacity-50"
            disabled={hasMounted ? dynamicDisabledCondition : false}
          >
            Add New Event
          </button>
          <button
            onClick={handleSave}
            disabled={hasMounted ? dynamicDisabledCondition : false}
            className="flex-grow px-4 py-2 bg-[var(--color-primary)] text-white font-semibold rounded-md shadow-sm hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-0 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save All Events"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EventsPage;
