"use client";

import { createContext, useContext } from "react";
import type { DashboardFilters } from "@/app/components/charts/ChartComponents";

type DashboardRouteFiltersContextValue = {
  filters: DashboardFilters;
  timezone: string;
};

export const DashboardRouteFiltersContext =
  createContext<DashboardRouteFiltersContextValue | null>(null);

export const useDashboardRouteFilters = () => useContext(DashboardRouteFiltersContext);
