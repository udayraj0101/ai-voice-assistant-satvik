import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";

const path = fileURLToPath(import.meta.url);

export default ({ mode, command }) => {
  const isSSR = mode === "ssr";
  const isDev = command === "serve";
  const isRender = process.env.RENDER === "true"; // 👈 Detect if running on Render

  return {
    root: join(dirname(path), "client"),
    plugins: [react()],
    build: {
      outDir: isSSR
        ? resolve(__dirname, "dist/server")
        : resolve(__dirname, "dist/client"),
      emptyOutDir: true,
      rollupOptions: {
        input: isSSR
          ? join(dirname(path), "client/entry-server.jsx")
          : join(dirname(path), "client/index.html"),
      },
      ssr: isSSR ? join(dirname(path), "client/entry-server.jsx") : undefined,
    },
    server: {
      host: true,
      allowedHosts: ['.onrender.com'],
    },
  };
};
