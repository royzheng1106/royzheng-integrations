import express from "express";
import telegramRouter from "./integrations/telegram/index.js";
import sendResponseRouter from "./api/sendResponse.js";
import { CONFIG } from "./utils/config.js";

const app = express();

// Increase request size limit to handle base64 audio
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ limit: "5mb", extended: true }));

// Middleware for API key
function requireApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  let apiKey = "";

  let authHeader = Array.isArray(req.headers['authorization'])
    ? req.headers['authorization'][0]
    : req.headers['authorization'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.substring(7); // strip 'Bearer '
  }
  if (apiKey !== CONFIG.API_KEY) {
    return res.status(401).json({ ok: false, error: 'Unauthorized: invalid API key' });
  }
  next();
}

function requireTelegramSecret(req: express.Request, res: express.Response, next: express.NextFunction) {
  // const apiKey = req.headers['x-telegram-bot-api-secret-token'];
  // console.log(apiKey);
  // console.log(CONFIG.TELEGRAM_SECRET);
  // if (apiKey !== CONFIG.TELEGRAM_SECRET) return res.status(403).send("Forbidden");
  next();
}

app.get("/", (_req, res) => res.send("💻 royzheng-integrations running"));
app.get("/_health", (_req, res) => res.send("💻 royzheng-integrations running"));
app.post("/", (_req, res) => res.send("💻 royzheng-integrations running"));

app.use("/api/telegram", requireTelegramSecret, telegramRouter);

app.use("/api/send-response", requireApiKey, sendResponseRouter);

if (!CONFIG.IS_VERCEL) {
  app.listen(CONFIG.PORT, () => {
    console.log(`💻 Local server running at http://localhost:${CONFIG.PORT}`);
  });
}

export default app;
