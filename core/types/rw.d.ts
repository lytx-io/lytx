import type { AppContext } from "../src/types/app-context";

declare module "rwsdk/worker" {
  interface DefaultAppContext extends AppContext {}
}


