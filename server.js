import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { randomUUID } from "crypto";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.OPENAI_API_KEY;
const isDev = process.argv.includes("--dev");

// Session tracking
const sessions = new Map();
const callLogFile = 'call-logs.json';
const CALL_TIME_LIMIT = 60000; // 1 minute in milliseconds

// Call logging function
function logCall(sessionData) {
  let logs = [];
  try {
    if (fs.existsSync(callLogFile)) {
      logs = JSON.parse(fs.readFileSync(callLogFile, 'utf8'));
    }
  } catch (error) {
    console.error('Error reading call logs:', error);
  }

  logs.push(sessionData);

  try {
    fs.writeFileSync(callLogFile, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Error writing call logs:', error);
  }
}

// Handoff function
function initiateHandoff(sessionId) {
  const sessionData = sessions.get(sessionId);
  if (sessionData) {
    sessionData.needsHandoff = true;
    sessionData.handoffReason = 'time_limit_exceeded';
    console.log(`Handoff initiated for session ${sessionId}`);
  }
}

async function startServer() {
  // Add JSON parsing middleware
  app.use(express.json());

  let vite;
  if (isDev) {
    vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: 'localhost',
      },
      appType: 'custom',
    });

    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist/client")));
  }

  app.get("/token", async (req, res) => {
    const sessionId = randomUUID();
    const startTime = Date.now();

    try {
      const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          "model": "gpt-4o-realtime-preview-2024-12-17",
          "voice": "alloy",
          "instructions": "You are Priya, a friendly AI assistant for Saatvik Group. You have 1 minute total but NEVER mention time limits to users. Naturally wrap up conversations efficiently.\\n\\nINTRODUCTION:\\nAlways start with: \\\"Namaste! Main Priya, Saatvik Group ki AI assistant. Aaj main aapki kaise help kar sakti hoon?\\\"\\n\\nCOMPANY INFO:\\n• Saatvik Group - Solar PV modules aur EPC services\\n• Products: MonoPERC, Bifacial, N-TopCon panels, solar pumps\\n• Services: Residential/commercial/industrial solar\\n• Location: Ambala, Haryana\\n\\nGUIDELINES:\\n• Keep responses under 10 seconds and very concise\\n• Answer simple queries quickly (location, basic products, business hours)\\n• For complex queries: Immediately say \\\"Main aapko humare expert se connect kar deti hoon for detailed help\\\"\\n• After 45 seconds: Start wrapping up naturally - \\\"Kya aur kuch help chahiye? Main aapko specialist se connect kar sakti hoon\\\"\\n• Focus: Quick answers, lead capture, smooth handoffs\\n• Never mention time constraints to users"
        }),
      });

      const data = await response.json();

      // Track session
      sessions.set(sessionId, {
        startTime,
        userIP: req.ip || 'unknown',
        needsHandoff: false,
        handoffReason: null,
        queryType: 'unknown'
      });

      // 1-minute timeout with handoff
      setTimeout(() => {
        const sessionData = sessions.get(sessionId);
        if (sessionData) {
          const duration = (Date.now() - sessionData.startTime) / 1000 / 60;
          const estimatedCost = duration * 0.30;

          // Initiate handoff if session still active
          if (!sessionData.needsHandoff) {
            initiateHandoff(sessionId);
          }

          logCall({
            sessionId,
            timestamp: new Date().toISOString(),
            duration: parseFloat(duration.toFixed(2)),
            estimatedCost: parseFloat(estimatedCost.toFixed(4)),
            userIP: sessionData.userIP,
            status: 'time_limit_handoff',
            needsHandoff: true,
            handoffReason: 'time_limit_exceeded',
            queryType: sessionData.queryType
          });
        }
        sessions.delete(sessionId);
      }, CALL_TIME_LIMIT);

      data.sessionId = sessionId;
      res.json(data);
    } catch (error) {
      console.error("Token generation error:", error);
      res.status(500).json({ error: "Failed to generate token" });
    }
  });

  // End session endpoint
  app.post("/end-session", (req, res) => {
    const { sessionId, queryType } = req.body;
    const sessionData = sessions.get(sessionId);

    if (sessionData) {
      const duration = (Date.now() - sessionData.startTime) / 1000 / 60;
      const estimatedCost = duration * 0.30;

      // Update query type if provided
      if (queryType) {
        sessionData.queryType = queryType;
      }

      const callLog = {
        sessionId,
        timestamp: new Date().toISOString(),
        duration: parseFloat(duration.toFixed(2)),
        estimatedCost: parseFloat(estimatedCost.toFixed(4)),
        userIP: sessionData.userIP,
        status: duration < 1 ? 'quick_resolved' : 'user-ended',
        needsHandoff: sessionData.needsHandoff,
        handoffReason: sessionData.handoffReason,
        queryType: sessionData.queryType || 'unknown'
      };

      logCall(callLog);
      sessions.delete(sessionId);

      res.json(callLog);
    } else {
      res.status(404).json({ error: "Session not found" });
    }
  });

  // Check handoff status
  app.get("/handoff-status/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    const sessionData = sessions.get(sessionId);
    
    if (sessionData) {
      res.json({
        needsHandoff: sessionData.needsHandoff,
        handoffReason: sessionData.handoffReason,
        timeRemaining: Math.max(0, CALL_TIME_LIMIT - (Date.now() - sessionData.startTime))
      });
    } else {
      res.status(404).json({ error: "Session not found" });
    }
  });

  // Get call summary
  app.get("/call-summary", (req, res) => {
    try {
      let logs = [];
      if (fs.existsSync(callLogFile)) {
        logs = JSON.parse(fs.readFileSync(callLogFile, 'utf8'));
      }

      const totalCalls = logs.length;
      const totalDuration = logs.reduce((sum, call) => sum + call.duration, 0);
      const totalCost = logs.reduce((sum, call) => sum + call.estimatedCost, 0);
      const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;
      const avgCost = totalCalls > 0 ? totalCost / totalCalls : 0;
      
      // Call categorization
      const quickResolved = logs.filter(call => call.status === 'quick_resolved').length;
      const handoffCalls = logs.filter(call => call.needsHandoff).length;
      const handoffRate = totalCalls > 0 ? (handoffCalls / totalCalls * 100).toFixed(1) : 0;
      
      // Query type analysis
      const queryTypes = logs.reduce((acc, call) => {
        const type = call.queryType || 'unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      res.json({
        totalCalls,
        totalDuration: parseFloat(totalDuration.toFixed(2)),
        totalCost: parseFloat(totalCost.toFixed(4)),
        avgDuration: parseFloat(avgDuration.toFixed(2)),
        avgCost: parseFloat(avgCost.toFixed(4)),
        quickResolved,
        handoffCalls,
        handoffRate: parseFloat(handoffRate),
        queryTypes,
        recentCalls: logs.slice(-10)
      });
    } catch (error) {
      console.error('Error getting call summary:', error);
      res.status(500).json({ error: 'Failed to get call summary' });
    }
  });

  // Call summary page
  app.get("/call-summary-page", (req, res) => {
    try {
      const summaryHtml = fs.readFileSync(
        path.resolve(__dirname, "client/call-summary.html"),
        "utf-8"
      );
      res.status(200).set({ "Content-Type": "text/html" }).end(summaryHtml);
    } catch (error) {
      console.error("Call summary page error:", error);
      res.status(500).send("Error loading call summary");
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
    console.log('✅ 1-minute call limit with handoff system enabled');
    console.log('✅ Call categorization and query tracking active');
    console.log('✅ Dead call optimization: Quick resolution or human handoff');
  });
}

startServer();