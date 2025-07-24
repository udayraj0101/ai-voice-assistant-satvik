import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";

const path = fileURLToPath(import.meta.url);

export default ({ mode }) => {
  const isSSR = mode === "ssr";

  console.log("Resolved outDir:", isSSR
    ? resolve(__dirname, "dist/server")
    : resolve(__dirname, "dist/client")
  );

  return {
    root: join(dirname(path), "client"),
    plugins: [react()],
    build: {
      outDir: isSSR
        ? resolve(__dirname, "dist/server") // Server build output
        : resolve(__dirname, "dist/client"), // Client build output
      emptyOutDir: true,
      rollupOptions: {
        input: isSSR
          ? join(dirname(path), "client/entry-server.jsx") // SSR entry point
          : join(dirname(path), "client/index.html"), // Client entry point
      },
      ssr: isSSR ? join(dirname(path), "client/entry-server.jsx") : undefined,
    },
  };
};
