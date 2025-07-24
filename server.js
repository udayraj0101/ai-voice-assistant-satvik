import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.OPENAI_API_KEY;
const isDev = process.argv.includes("--dev");

async function startServer() {
  let vite;
  if (isDev) {
    vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: 'localhost', // optional
      },
      appType: 'custom',
    });


    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist/client")));
  }

  app.get("/token", async (req, res) => {
    try {
      const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2025-06-03",
          voice: "shimmer",
          instructions: `
      You are Priya, a friendly and intelligent Indian salesperson for Mamaearth.
      Your goal: assist users by recommending Mamaearth products—but never force them.
      You speak in Hinglish, mixing Hindi & English naturally.
      Use warm and helpful tone.
      
      Always start the conversation by introducing yourself: "Namaste! Main Priya hoon, Mamaearth ki AI assistant. Aaj main aapki kaise help kar sakti hoon?" (Hello! I am Priya, Mamaearth's AI assistant. How can I help you today?)

      **Cart of top Mamaearth products:**
      1. Mamaearth Vitamin C Face Wash – brightens and cleanses with niacinamide & vitamin C.  
      2. Mamaearth Onion Hair Oil – controls hair fall, nourishes scalp with natural oils.  
      3. Mamaearth C3 Face Mask (Charcoal, Coffee, Clay) – detoxifies without over-drying.  
      4. Mamaearth Rice Water Shampoo – repairs damaged hair, reduces split ends.  
      5. Mamaearth Ultra Light Indian Sunscreen SPF 50 – no white cast, natural ingredients.

      **Handling user interaction:**
      - If user asks for product details, share ingredients, benefits, and typical user reviews.
      - If user compares with other brands, explain pros and cons objectively but highlight unique Mamaearth advantages (e.g., Made Safe certified, toxin-free).
      - Always respect user's readiness—if they're unsure or decline, offer small suggestions or promotions like "20% off for first-time buyers" but never pushy.
      - End each sales pitch with a gentle offer: free samples, bundle deals, or discounted price.
    `,
        }),
      });

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Token generation error:", error);
      res.status(500).json({ error: "Failed to generate token" });
    }
  });

  if (isDev) {
    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const template = await vite.transformIndexHtml(
          url,
          fs.readFileSync("./client/index.html", "utf-8")
        );
        const { render } = await vite.ssrLoadModule("./client/entry-server.jsx");
        const appHtml = await render(url);
        const html = template.replace(`<!--ssr-outlet-->`, appHtml?.html || "");
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        console.error("SSR error in dev:", e);
        res.status(500).end(e.message);
      }
    });
  } else {
    app.get("*", async (req, res) => {
      const indexPath = path.resolve(__dirname, "dist/client/index.html");
      const ssrEntryPath = path.resolve(__dirname, "dist/server/entry-server.js");

      if (!fs.existsSync(indexPath) || !fs.existsSync(ssrEntryPath)) {
        console.error("Required files not found:", { indexPath, ssrEntryPath });
        return res.status(404).send("Required files not found");
      }

      try {
        const template = fs.readFileSync(indexPath, "utf-8");
        const { render } = await import(ssrEntryPath);
        const appHtml = await render(req.originalUrl);
        const html = template.replace(`<!--ssr-outlet-->`, appHtml?.html || "");
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (error) {
        console.error("Error during SSR rendering:", error);
        res.status(500).send("Internal Server Error");
      }
    });
  }

  app.listen(port, () => {
    console.log(`Server running on *:${port} (${isDev ? "development" : "production"} mode)`);
  });
}

startServer();
