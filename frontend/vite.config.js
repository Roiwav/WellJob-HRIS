import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * WELLJOB HRIS frontend build configuration.
 *
 * Notes:
 * - `base: "/"` keeps generated asset URLs rooted at the deployed frontend origin.
 * - `host: true` allows the development/preview server to be reached from
 *   other authorized devices on the LAN/Tailscale network when the host OS
 *   and firewall allow it.
 * - SPA direct-route fallback is a hosting concern. Vite development/preview
 *   supports SPA fallback, but the final production host must also rewrite
 *   non-file frontend routes to `index.html`.
 */
export default defineConfig({
  base: "/",

  plugins: [
    react(),
  ],

  server: {
    host: true,
  },

  preview: {
    host: true,
  },
});
