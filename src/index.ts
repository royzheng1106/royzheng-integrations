import express from "express";
import telegramRouter from "./integrations/telegram/index.js";
import sendResponseRouter from "./api/sendResponse.js";
import { CONFIG } from "./utils/config.js";

const app = express();

// Increase request size limit to handle base64 audio
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Middleware for API key
function requireApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  if(!CONFIG.IS_VERCEL) {
    next()
  }
  const apiKey = req.headers['X-Telegram-Bot-Api-Secret-Token'];
  if (apiKey !== CONFIG.API_KEY) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  next();
}

app.get("/", (_req, res) => res.send("💻 royzheng-integrations running"));
app.post("/", (_req, res) => res.send("💻 royzheng-integrations running"));

// Existing Telegram routes
app.use("/api/telegram", telegramRouter);

app.use("/api/send-response", requireApiKey, sendResponseRouter);

if (!CONFIG.IS_VERCEL) {
  app.listen(CONFIG.PORT, () => {
    console.log(`💻 Local server running at http://localhost:${CONFIG.PORT}`);
  });
}

export default app;
