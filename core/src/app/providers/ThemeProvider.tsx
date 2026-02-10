"use client";
import React, { createContext, useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

interface ThemeContextType {
  theme: "light" | "dark";
  isInitialized: boolean;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType | null>(null);

export const useTheme = () => {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
  // defaultTheme?: Theme;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [isInitialized, setIsInitialized] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme") as Theme;
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      const initialTheme = savedTheme || systemTheme;

      setThemeState(initialTheme);
      setIsInitialized(true);
    }
  }, []);
  useEffect(() => {
    if (isInitialized && typeof window !== "undefined") {
      const root = document.documentElement;

      // Temporarily enable transitions for theme changes only.
      root.classList.add("theme-transition");
      const timeout = window.setTimeout(() => {
        root.classList.remove("theme-transition");
      }, 250);

      root.setAttribute("data-theme", theme);
      localStorage.setItem("theme", theme);

      return () => {
        window.clearTimeout(timeout);
        root.classList.remove("theme-transition");
      };
    }
  }, [theme, isInitialized]);

  const toggleTheme = useCallback(() => {
    setThemeState((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  }, []);

  // // Memoize the context value
  // const contextValue: ThemeContextType = useMemo(
  //   () => ({
  //     theme,
  //     isInitialized,
  //     toggleTheme,
  //   }),
  //   [theme, isInitialized, toggleTheme],
  // );

  const contextValue = {
    theme,
    isInitialized,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};
