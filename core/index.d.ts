import type { Database } from "./src/types/supabase";
import "typed-htmx";
declare global {
  type sites = Array<Database["public"]["Tables"]["sites"]["Row"]> | null;
  type site = Database["public"]["Tables"]["sites"]["Row"];
  type scriptModules = "startDashboard" | "startApp";
  interface siteEvents {
    event: string;
    date: Date;
    page: string;
    city: string;
    country: string;
    region: string;
    device: string;
    browser: string;
    os: string;
  }
  declare module '*.wasm'
  namespace Hono {
    interface HTMLAttributes extends HtmxAttributes {
    }
  }
  namespace User {
    type Role = 'admin' | 'editor' | 'view_only';

    type MetaData = {
      name: string;
      company: string;
      account_id: number;
      role: Role;
      permissions: {
        all: boolean,
        allowed: Array<string>
      }
    };
  }
}
export { };
