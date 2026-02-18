declare module "@opentui/core" {
  export type ParsedKey = {
    name?: string;
    ctrl?: boolean;
    shift?: boolean;
  };

  export class CliRenderer {
    [key: string]: any;
    terminalWidth: number;
    terminalHeight: number;
    console: { toggle: () => void };
    constructor(...args: any[]);
    start(): void;
    stop(): void;
    auto(): void;
    toggleDebugOverlay(): void;
    dumpHitGrid(): void;
    add(...args: any[]): void;
    setBackgroundColor(...args: any[]): void;
  }

  export class BoxRenderable {
    [key: string]: any;
    constructor(...args: any[]);
    add(...args: any[]): void;
  }

  export class TextRenderable {
    [key: string]: any;
    constructor(...args: any[]);
  }

  export function createCliRenderer(...args: any[]): CliRenderer;
  export function getKeyHandler(): {
    on: (event: string, cb: (key: ParsedKey) => void) => void;
    off: (event: string, cb: (key: ParsedKey) => void) => void;
  };
}

declare module "react-simple-maps" {
  import type { ComponentType } from "react";

  export const ComposableMap: ComponentType<any>;
  export const Geographies: ComponentType<any>;
  export const Geography: ComponentType<any>;
  export const Marker: ComponentType<any>;
  export const ZoomableGroup: ComponentType<any>;
}

declare module "@supabase/supabase-js" {
  export function createClient<T = any>(url: string, key: string): any;
}
