import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import alchemy from "alchemy/cloudflare/redwood";
import { lytxConsumerVitePlugin } from "lytx/vite";

export default defineConfig({
  plugins: [...lytxConsumerVitePlugin(), alchemy(), tailwindcss()],
});
