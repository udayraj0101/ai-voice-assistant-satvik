import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";

const path = fileURLToPath(import.meta.url);

export default ({ mode }) => {
  const isSSR = mode === "ssr";

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
      allowedHosts: ['.onrender.com'], // ✅ Allow any Render host
      host: true // ✅ Required to accept external traffic
    }
  };
};
