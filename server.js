import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { randomUUID } from "crypto";
import mongoose from "mongoose";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.OPENAI_API_KEY;
const isDev = process.argv.includes("--dev");

// MongoDB connection
const mongoUri = process.env.MONGODB_URI;
mongoose.connect(mongoUri);

// Call Log Schema
const callLogSchema = new mongoose.Schema({
  sessionId: String,
  timestamp: Date,
  duration: Number,
  estimatedCost: Number,
  userIP: String,
  status: String,
  queryType: String,
  needsHandoff: Boolean,
  handoffReason: String
});

const CallLog = mongoose.model('CallLog', callLogSchema, 'call_logs');

// Session tracking
const sessions = new Map();
const CALL_TIME_LIMIT = 60000; // 1 minute

// Call logging function
async function logCall(sessionData) {
  try {
    const callLog = new CallLog(sessionData);
    await callLog.save();
    console.log('Call logged to MongoDB:', sessionData.sessionId);
  } catch (error) {
    console.error('Error saving call log to MongoDB:', error);
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
  app.use(express.json());

  let vite;
  if (isDev) {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist/client")));
  }

  // API route for token generation
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
          model: "gpt-4o-realtime-preview-2024-12-17",
          voice: "alloy",
          instructions: "You are Priya, a friendly AI assistant for Saatvik Group. Speak naturally in Hinglish and keep responses concise.\n\nINTRODUCTION:\nAlways start with: \"Namaste! Main Priya, Saatvik Group ki AI assistant. Aaj main aapki kaise help kar sakti hoon?\"\n\nCOMPANY INFO:\n• Saatvik Group - Solar PV modules aur EPC services\n• Products: MonoPERC, Bifacial, N-TopCon panels, solar pumps\n• Services: Residential/commercial/industrial solar\n• Location: Ambala, Haryana\n\nGUIDELINES:\n• Be friendly, helpful, and positive\n• Keep responses under 15 seconds\n• For simple queries: Provide quick, direct answers\n• For complex queries: \"Yeh detailed question hai, main aapko humare expert se connect kar deti hoon\"\n• Focus on: Quick info, lead qualification, appointment booking\n• Direct to saatvikgroup.com for detailed pricing/technical info"
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

      // 1-minute timeout
      setTimeout(async () => {
        const sessionData = sessions.get(sessionId);
        if (sessionData) {
          const duration = (Date.now() - sessionData.startTime) / 1000 / 60;
          
          if (!sessionData.needsHandoff) {
            initiateHandoff(sessionId);
          }

          await logCall({
            sessionId,
            timestamp: new Date(),
            duration: parseFloat(duration.toFixed(2)),
            estimatedCost: parseFloat((duration * 0.30).toFixed(4)),
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
  app.post("/end-session", async (req, res) => {
    const { sessionId, queryType } = req.body;
    const sessionData = sessions.get(sessionId);

    if (sessionData) {
      const duration = (Date.now() - sessionData.startTime) / 1000 / 60;
      
      if (queryType) {
        sessionData.queryType = queryType;
      }

      await logCall({
        sessionId,
        timestamp: new Date(),
        duration: parseFloat(duration.toFixed(2)),
        estimatedCost: parseFloat((duration * 0.30).toFixed(4)),
        userIP: sessionData.userIP,
        status: duration < 1 ? 'quick_resolved' : 'user-ended',
        needsHandoff: sessionData.needsHandoff,
        handoffReason: sessionData.handoffReason,
        queryType: sessionData.queryType || 'unknown'
      });

      sessions.delete(sessionId);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Session not found" });
    }
  });



  // Basic auth middleware
  function basicAuth(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Call Summary"');
      return res.status(401).send('Authentication required');
    }
    
    const credentials = Buffer.from(auth.slice(6), 'base64').toString().split(':');
    const username = credentials[0];
    const password = credentials[1];
    
    if (username === 'admin' && password === 'saatvik123') {
      next();
    } else {
      res.setHeader('WWW-Authenticate', 'Basic realm="Call Summary"');
      res.status(401).send('Invalid credentials');
    }
  }

  // Call summary page with auth
  app.get("/call-summary-page", basicAuth, (req, res) => {
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

  // Protect call summary API too
  app.get("/call-summary", basicAuth, async (req, res) => {
    try {
      const logs = await CallLog.find().sort({ timestamp: -1 });
      const totalCalls = logs.length;
      const totalDuration = logs.reduce((sum, call) => sum + call.duration, 0);
      const totalCost = logs.reduce((sum, call) => sum + call.estimatedCost, 0);
      const quickResolved = logs.filter(call => call.status === 'quick_resolved').length;
      const handoffCalls = logs.filter(call => call.needsHandoff).length;

      res.json({
        totalCalls,
        totalDuration: parseFloat(totalDuration.toFixed(2)),
        totalCost: parseFloat(totalCost.toFixed(4)),
        quickResolved,
        handoffCalls,
        handoffRate: totalCalls > 0 ? parseFloat((handoffCalls / totalCalls * 100).toFixed(1)) : 0,
        recentCalls: logs.slice(0, 10)
      });
    } catch (error) {
      console.error('Error fetching call summary:', error);
      res.status(500).json({ error: 'Failed to get call summary' });
    }
  });

  // Protect call logs API too
  app.get("/call-logs", basicAuth, async (req, res) => {
    try {
      const logs = await CallLog.find().sort({ timestamp: -1 });
      res.json(logs);
    } catch (error) {
      console.error('Error fetching call logs:', error);
      res.status(500).json({ error: 'Failed to read call logs' });
    }
  });

  // Render the React client
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
        next(e);
      }
    });
  } else {
    app.get("*", async (req, res) => {
      const indexPath = path.resolve(__dirname, "dist/client/index.html");
      const ssrEntryPath = path.resolve(__dirname, "dist/server/entry-server.js");

      if (!fs.existsSync(indexPath) || !fs.existsSync(ssrEntryPath)) {
        return res.status(404).send("Required files not found");
      }

      try {
        const template = fs.readFileSync(indexPath, "utf-8");
        const { render } = await import(ssrEntryPath);
        const appHtml = await render(req.originalUrl);
        const html = template.replace(`<!--ssr-outlet-->`, appHtml?.html || "");
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (error) {
        res.status(500).send("Internal Server Error");
      }
    });
  }

  app.listen(port, () => {
    console.log(`Server running on *:${port} (${isDev ? "development" : "production"} mode)`);
    console.log('✅ 1-minute call limit with MongoDB logging enabled');
    console.log('✅ Connected to MongoDB - call logs will persist permanently');
  });
}

startServer();