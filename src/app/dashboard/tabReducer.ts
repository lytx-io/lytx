export type TabState = {
  topSourcesTab: "Sources" | "Referrers";
  topPagesTab: "By Views" | "By Exits";
  locationsTab: "Countries" | "Cities";
  devicesTab: "Browser" | "OS";
};

type TabAction =
  | { type: "SET_TOP_SOURCES_TAB"; payload: "Sources" | "Referrers" }
  | { type: "SET_TOP_PAGES_TAB"; payload: "By Views" | "By Exits" }
  | { type: "SET_LOCATIONS_TAB"; payload: "Countries" | "Cities" }
  | { type: "SET_DEVICES_TAB"; payload: "Browser" | "OS" };

export function tabReducer(state: TabState, action: TabAction): TabState {
  switch (action.type) {
    case "SET_TOP_SOURCES_TAB":
      return { ...state, topSourcesTab: action.payload };
    case "SET_TOP_PAGES_TAB":
      return { ...state, topPagesTab: action.payload };
    case "SET_LOCATIONS_TAB":
      return { ...state, locationsTab: action.payload };
    case "SET_DEVICES_TAB":
      return { ...state, devicesTab: action.payload };
    default:
      return state;
  }
}

export const initialTabState: TabState = {
  topSourcesTab: "Sources",
  topPagesTab: "By Views",
  locationsTab: "Countries",
  devicesTab: "Browser",
};
