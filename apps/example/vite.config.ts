import { defineConfig } from "vite";

// Paths resolve against the app directory, where the workspace scripts run.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        effects: "effects.html",
        bench: "bench.html",
        showcase: "showcase.html",
        specimen: "specimen.html",
      },
    },
  },
});
