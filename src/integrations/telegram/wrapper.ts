import { Event } from "../../models/Event.js";
import { USER_WHITELIST } from "../../utils/userAccessControl.js";
import { v4 as uuidv4 } from "uuid";
import { CONFIG } from "../../utils/config.js";

// --- Allowed MIME types ---
const allowedAudioMimeTypes = [
  "audio/wav",
  "audio/mp3",
  "audio/aiff",
  "audio/aac",
  "audio/ogg",
  "audio/flac"
];

const allowedImageMimeTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif"
];

/**
 * Resolve the internal agent ID for a Telegram sender.
 */

function getAgentId(sender: { id?: number; chatId?: number }): string | null {
  if (!sender) return null;

  const ids = [sender.id, sender.chatId].filter(Boolean).map(String);
  for (const id of ids) {
    if (USER_WHITELIST[id]) return USER_WHITELIST[id];
  }
  return null;
}

/**
 * Send a Telegram message back to the user (for limits or warnings).
 */
async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const botToken = CONFIG.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("Missing TELEGRAM_BOT_TOKEN in environment");

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

/**
 * Retrieve Telegram file URL + format + size.
 */
async function getTelegramFileUrl(
  fileId: string
): Promise<{ url: string; format: string; size: number }> {
  const botToken = CONFIG.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("Missing TELEGRAM_BOT_TOKEN in environment");

  const res = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  const data = await res.json();

  if (!data.ok || !data.result?.file_path) {
    throw new Error("Failed to retrieve Telegram file path");
  }

  const filePath = data.result.file_path;
  const format = filePath.split(".").pop() || "bin";
  const size = data.result.file_size ?? 0;
  const url = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  return { url, format, size };
}

/**
 * Download a Telegram file and return its Base64-encoded data.
 */
async function fetchTelegramFileBase64(fileId: string): Promise<{ base64: string; format: string }> {
  const { url, format } = await getTelegramFileUrl(fileId);
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return { base64, format };
}

/**
 * Convert a raw Telegram message into a normalized Event object.
 */
export async function wrapTelegramMessage(raw: any): Promise<Event | null> {
  const message = raw?.message ?? raw;
  if (!message) throw new Error("Invalid Telegram payload: missing message object");

  const sender = message.from ?? {};
  const chat = message.chat ?? {};

  const senderIdentity: Event["sender"] = {
    source: "telegram",
    isBot: sender.is_bot,
    messageId: message.message_id,
    chatId: chat.id,
    userId: sender.id,
    ...(sender.first_name ? { firstName: sender.first_name } : {}),
    ...(sender.last_name ? { lastName: sender.last_name } : {}),
    ...(sender.username ? { username: sender.username } : {}),
  };

  const timestamp = message.date
    ? new Date(message.date * 1000).toISOString()
    : new Date().toISOString();

  const agentId = getAgentId({ id: sender.id, chatId: chat.id }) ?? "unknown";
  const messages: Event["messages"] = [];

  // --- CONFIGURABLE LIMITS (safe for Vercel) ---
  const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3 MB
  const MAX_AUDIO_SIZE = 3 * 1024 * 1024; // 3 MB

  const metadata: Record<string, any> = {};

  // --- TEXT ---
  if (message.text) {
    messages.push({ type: "text", text: message.text });
  }

  // --- PHOTO ---
  else if (message.photo?.length) {
    const bestPhoto = message.photo[message.photo.length - 1];
    const fileId = bestPhoto?.file_id;

    if (fileId) {
      const { url, size } = await getTelegramFileUrl(fileId);

      // 🚫 Check size before download
      if (size > MAX_IMAGE_SIZE) {
        await sendTelegramMessage(
          chat.id,
          `⚠️ The image is too large (${(size / 1024 / 1024).toFixed(
            2
          )} MB). Please send an image smaller than ${(MAX_IMAGE_SIZE / 1024 / 1024).toFixed(1)} MB.`
        );
        return null;
      }

      messages.push({
        type: "image_url",
        imageUrl: { url, format: "image/jpeg" },
      });

      metadata.imageUrl = url;
      metadata.imageSize = size;

      if (message.caption) {
        messages.push({ type: "text", text: message.caption });
      }
    }
  }

  // --- AUDIO / VOICE ---
  else if (message.audio || message.voice) {
    const isVoice = Boolean(message.voice);
    const audio = message.audio ?? message.voice;
    const fileId = audio?.file_id;

    if (fileId) {
      const { url, format, size } = await getTelegramFileUrl(fileId);

      // 🚫 Check size before download
      if (size > MAX_AUDIO_SIZE) {
        if (isVoice) {
          await sendTelegramMessage(
            chat.id,
            `🎤 Your voice message is too long. Please try speaking shorter or sending a smaller voice note.`
          );
        } else {
          await sendTelegramMessage(
            chat.id,
            `⚠️ The audio file is too large (${(size / 1024 / 1024).toFixed(
              2
            )} MB). Please send an audio file smaller than ${(MAX_AUDIO_SIZE / 1024 / 1024).toFixed(1)} MB.`
          );
        }
        return null;
      }

      const { base64 } = await fetchTelegramFileBase64(fileId);

      messages.push({
        type: "input_audio",
        inputAudio: { data: base64, format },
      });

      metadata.audioUrl = url;
      metadata.audioSize = size;
    }
  }

  // --- LOCATION ---
  else if (message.location) {
    const { latitude, longitude } = message.location;
    messages.push({
      type: "text",
      text: `I am currently at:\nLatitude: ${latitude}\nLongitude: ${longitude}\nFormat: WGS84 decimal degrees`,
    });
  }
  // --- DOCUMENT ---
  else if (message.document) {
    const doc = message.document;
    const fileId = doc.file_id;
    const { mime_type, file_name } = doc;

    // Check if audio
    if (allowedAudioMimeTypes.includes(mime_type)) {
      const { url, size } = await getTelegramFileUrl(fileId);

      if (size > MAX_AUDIO_SIZE) {
        await sendTelegramMessage(
          chat.id,
          `⚠️ The audio file is too large (${(size / 1024 / 1024).toFixed(
            2
          )} MB). Please send an audio file smaller than ${(MAX_AUDIO_SIZE / 1024 / 1024).toFixed(1)} MB.`
        );
        return null;
      }

      const { base64 } = await fetchTelegramFileBase64(fileId);

      messages.push({
        type: "input_audio",
        inputAudio: { data: base64, format: mime_type },
      });

      metadata.audioUrl = url;
      metadata.audioSize = size;
    }
    // Check if image
    else if (allowedImageMimeTypes.includes(mime_type)) {
      const { url, size } = await getTelegramFileUrl(fileId);

      if (size > MAX_IMAGE_SIZE) {
        await sendTelegramMessage(
          chat.id,
          `⚠️ The image is too large (${(size / 1024 / 1024).toFixed(
            2
          )} MB). Please send an image smaller than ${(MAX_IMAGE_SIZE / 1024 / 1024).toFixed(1)} MB.`
        );
        return null;
      }

      messages.push({
        type: "image_url",
        imageUrl: { url, format: mime_type },
      });

      metadata.imageUrl = url;
      metadata.imageSize = size;
    }
    // Unsupported
    else {
      await sendTelegramMessage(
        chat.id,
        `❌ File format not supported: ${mime_type}. Please send an accepted audio or image file.`
      );
      return null;
    }

    // Include caption as text if present
    if (doc.caption) {
      messages.push({ type: "text", text: doc.caption });
    }
  }
  // --- FALLBACK ---
  else {
      await sendTelegramMessage(
        chat.id,
        `❌ Action not supported. Please send text, an image, a supported audio file or location.`
      );
  }

  return {
    id: message.message_id?.toString() ?? uuidv4(),
    agentId,
    timestamp,
    messages,
    sender: senderIdentity,
    recipients: [
      {
        channel: "telegram",
        chatId: chat.id,
        userId: sender.id,
      },
    ],
    metadata: Object.keys(metadata).length > 0 ? metadata : {},
  };
}

