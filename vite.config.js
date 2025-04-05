import { defineConfig } from "vite";

export default defineConfig({
  // Если используется Babel
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
        },
      },
    },
  },
});
