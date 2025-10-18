import { Router, Request, Response as ExResponse } from "express";
import { wrapTelegramMessage } from "./wrapper.js";
import { USER_WHITELIST } from "../../utils/userAccessControl.js";
import { sendTelegramResponse, TelegramBotFactory } from "../telegram/client.js";
import { CONFIG } from "../../utils/config.js";

const router = Router();
const EVENTS_API_URL = "https://royzheng-agents.vercel.app/api/events";

function isWhitelisted(userId?: number, chatId?: number): boolean {
  const ids = [userId, chatId].filter(Boolean).map(String);
  return ids.some(id => !!USER_WHITELIST[id]);
}

// Webhook POST endpoint
router.post("/", async (req: Request, res: ExResponse) => {
  try {
    const rawMessage = req.body.message ?? req.body;
    const sender = rawMessage.from ?? {};
    const chat = rawMessage.chat ?? {};

    console.log("📩 Incoming Telegram update:", rawMessage);

    // Only allow whitelisted users/chats
    if (!isWhitelisted(sender.id, chat.id)) {
      console.warn(`⚠️ Telegram message rejected: sender not whitelisted`, {
        userId: sender.id,
        chatId: chat.id,
      });

      await sendTelegramResponse({
        recipients: [
          { channel: "telegram", chatId: chat.id, userId: sender.id },
        ],
        messages: [{ type: "text", content: "❌ You are not allowed to use this bot." }],
      });

      return res.status(200).send("Forbidden: sender not whitelisted");
    }

    // Get singleton bot instance
    const bot = await TelegramBotFactory.getInstance();

    // 1️⃣ Wrap Telegram message and include placeholderMessageId
    const event = await wrapTelegramMessage(rawMessage);
    if (!event) return res.status(200).send("❌ File too large or unsupported.");

    // 2️⃣ Send immediate placeholder message
    const thinkingMsg = await bot.sendMessage(chat.id, "🤔 _Thinking..._", { parse_mode: "Markdown", disable_notification: true });
    const placeholderMessageId = thinkingMsg.message_id;

    event.metadata = {
      ...event.metadata,
      placeholderMessageId,
    };
    
    console.log("✅ Telegram Event (whitelisted):", event);

    // 3️⃣ Forward to remote API
    const response = await fetch(EVENTS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CONFIG.AGENTS_API_KEY!,
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      console.error(`❌ Failed to send event to API: ${response.statusText}`);
      return res.status(500).send("Failed to forward event");
    }

    console.log(`✅ Event forwarded to ${EVENTS_API_URL}`);
    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Telegram handler error:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Simple health check
router.get("/", (_req, res) => {
  res.status(200).send("👋 Telegram integration endpoint running");
});

export default router;
