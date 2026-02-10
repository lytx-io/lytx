const chartAccentOrange = "#f97316";

export const createChartTheme = (isDark: boolean) => ({
  background: "transparent",
  text: {
    fontSize: 12,
    fill: isDark ? "#ffffff" : "#111827",
    fontWeight: 600,
    outlineWidth: 0,
    outlineColor: "transparent",
  },
  axis: {
    domain: {
      line: {
        stroke: isDark ? "#575353" : "#E5E7EB",
        strokeWidth: 1,
      },
    },
    legend: {
      text: {
        fontSize: 12,
        fill: isDark ? "#ffffff" : "#6B7280",
        fontWeight: 600,
        outlineWidth: 0,
        outlineColor: "transparent",
      },
    },
    ticks: {
      line: {
        stroke: isDark ? "#575353" : "#E5E7EB",
        strokeWidth: 1,
      },
      text: {
        fontSize: 11,
        fill: isDark ? "#ffffff" : "#6B7280",
        fontWeight: 600,
        outlineWidth: 0,
        outlineColor: "transparent",
      },
    },
  },
  grid: {
    line: {
      stroke: isDark ? "#575353" : "#F3F4F6",
      strokeWidth: 1,
    },
  },
  legends: {
    title: {
      text: {
        fontSize: 11,
        fill: isDark ? "#ffffff" : "#6B7280",
        fontWeight: 600,
        outlineWidth: 0,
        outlineColor: "transparent",
      },
    },
    text: {
      fontSize: 11,
      fill: isDark ? "#ffffff" : "#6B7280",
      fontWeight: 600,
      outlineWidth: 0,
      outlineColor: "transparent",
    },
    ticks: {
      line: {},
      text: {
        fontSize: 10,
        fill: isDark ? "#ffffff" : "#6B7280",
        fontWeight: 600,
        outlineWidth: 0,
        outlineColor: "transparent",
      },
    },
  },
  labels: {
    text: {
      fontSize: 12,
      fill: isDark ? "#ffffff" : "#111827",
      fontWeight: 600,
      outlineWidth: 0,
      outlineColor: "transparent",
    },
  },
  annotations: {
    text: {
      fontSize: 13,
      fill: isDark ? "#ffffff" : "#111827",
      fontWeight: 600,
      outlineWidth: 2,
      outlineColor: isDark ? "#3c3c3c" : "#FFFFFF",
      outlineOpacity: 1,
    },
    link: {
      stroke: isDark ? "#575353" : "#6B7280",
      strokeWidth: 1,
      outlineWidth: 2,
      outlineColor: isDark ? "#3c3c3c" : "#FFFFFF",
      outlineOpacity: 1,
    },
    outline: {
      stroke: isDark ? "#575353" : "#6B7280",
      strokeWidth: 2,
      outlineWidth: 2,
      outlineColor: isDark ? "#3c3c3c" : "#FFFFFF",
      outlineOpacity: 1,
    },
    symbol: {
      fill: isDark ? "#575353" : "#6B7280",
      outlineWidth: 2,
      outlineColor: isDark ? "#3c3c3c" : "#FFFFFF",
      outlineOpacity: 1,
    },
  },
  tooltip: {
    container: {
      background: isDark ? "#484743" : "#FFFFFF",
      color: isDark ? "#ffffff" : "#111827",
      fontSize: 12,
      fontWeight: 600,
      borderRadius: "8px",
      boxShadow: isDark
        ? "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)"
        : "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
      border: `1px solid ${isDark ? "#575353" : "#E5E7EB"}`,
    },
    basic: {},
    chip: {},
    table: {},
    tableCell: {},
    tableCellValue: {},
  },
});

export const chartColors = {
  primary: ["#3B82F6", "#1D4ED8", "#1E40AF", "#1E3A8A", "#93C5FD"],
  secondary: ["#10B981", "#34D399", "#6EE7B7", "#A7F3D0", "#D1FAE5"],
  mixed: ["#3B82F6", "#10B981", chartAccentOrange, "#EF4444", "#1D4ED8", "#06B6D4"],
  gradient: [
    { offset: 0, color: "#3B82F6" },
    { offset: 100, color: "#1D4ED8" },
  ],
  map: ["#93C5FD", "#60A5FA", "#3B82F6", "#2563EB", "#1D4ED8"],
  line: ["#3B82F6"],
  funnel: ["#e05205", "#f06a1a", "#f97316", "#fb923c", "#fdba74"],
};
