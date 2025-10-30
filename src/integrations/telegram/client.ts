import TelegramBot from "node-telegram-bot-api";
import { CONFIG } from "../../utils/config.js";
import { Response, ResponseRecipient } from "../../models/Response.js";
import { transformMarkdown } from '../../utils/transformMarkdown.js';
import { Readable } from "stream";
/**
 * TelegramBotFactory
 * -----------------
 * Singleton pattern ensures:
 * 1. Only one bot instance exists.
 * 2. Webhook is initialized only once.
 * 3. Concurrent requests do not trigger multiple initializations.
 */
// export class TelegramBotFactory {
//   private static instance: TelegramBot | null = null;
//   private static webhookInitialized = false;
//   private static initializing: Promise<TelegramBot> | null = null;

//   public static async getInstance(): Promise<TelegramBot> {
//     if (this.instance) return this.instance;

//     if (!this.initializing) {
//       this.initializing = (async () => {
//         console.log("🌐 Initializing Telegram bot (webhook mode)...");

//         // Create bot in webhook mode
//         this.instance = new TelegramBot(CONFIG.TELEGRAM_BOT_TOKEN!, { webHook: true });

//         // Ensure webhook is configured correctly
//         if (!this.webhookInitialized) {
//           await this.ensureWebhook();
//           this.webhookInitialized = true;
//         }

//         console.log("✅ Telegram bot initialized.");
//         return this.instance!;
//       })();
//     }

//     return this.initializing;
//   }

//   private static async ensureWebhook() {
//     const bot = this.instance!;
//     const desiredUrl = `${CONFIG.BASE_URL}/api/telegram`;

//     try {
//       const info = await bot.getWebHookInfo();

//       if (!info.url) {
//         console.log("🔗 No webhook set — registering new one...");
//         await bot.setWebHook(desiredUrl);
//         console.log("🚀 Webhook successfully set at:", desiredUrl);
//       } else if (info.url !== desiredUrl) {
//         console.log(`🔄 Updating webhook from '${info.url}' → '${desiredUrl}'`);
//         await bot.setWebHook(desiredUrl);
//         console.log("✅ Webhook updated.");
//       } else {
//         console.log("✅ Webhook already configured correctly:", desiredUrl);
//       }
//     } catch (err) {
//       console.error("❌ Failed to get/set Telegram webhook:", err);
//       throw err;
//     }
//   }
// }

export class TelegramBotFactory {
  private static instance: TelegramBot | null = null;

  public static async getInstance(): Promise<TelegramBot> {
    if (!this.instance) {
      console.log("🌐 Using existing Telegram webhook setup...");
      this.instance = new TelegramBot(CONFIG.TELEGRAM_BOT_TOKEN!, { webHook: true });
    }
    return this.instance;
  }
}

/**
 * sendTelegramResponse
 * -------------------
 * Sends a response to one or more Telegram recipients.
 * Supports editing existing messages if `placeholderMessageId` is provided.
 */
export async function sendTelegramResponse(
  response: Response,
  specificRecipient?: ResponseRecipient
) {
  // Get singleton bot instance
  const bot = await TelegramBotFactory.getInstance();

  const recipients = specificRecipient ? [specificRecipient] : response.recipients;

  for (const recipient of recipients) {
    const chatId = recipient.chat_id;

    if (!chatId) {
      console.warn("⚠️ Missing chatId for Telegram response:", recipient);
      continue;
    }

    for (const msg of response.messages) {
      try {
        switch (msg.type) {
          // -------------------- Text message --------------------
          case "text": {
            const placeholderMessageId = Number(msg.placeholder_message_id);
            if (msg.text === undefined) {
              console.error('Message text is missing.');
              break;
            }
            const transformedContent = transformMarkdown(msg.text);

            // Check for editMessage flag in metadata
            const editMessage = response.metadata?.edit_message === true;

            if (editMessage && placeholderMessageId) {
              try {
                const res = await bot.editMessageText(transformedContent, {
                  chat_id: chatId,
                  message_id: placeholderMessageId,
                  parse_mode: "MarkdownV2",
                });
                console.log(`✅ Telegram editMessageText success for chatId ${chatId}:`, res);
              } catch (err: any) {
                console.error(`❌ Telegram editMessageText error for chatId ${chatId}:`, err);
                // fallback: send new message if edit fails
                await bot.sendMessage(chatId, transformedContent, {
                  parse_mode: "MarkdownV2",
                });
              }
            } else {
              const res = await bot.sendMessage(chatId, transformedContent, {
                parse_mode: "MarkdownV2",
              });
              console.log(`📨 Telegram sendMessage response for chatId ${chatId}:`, res);
            }

            // Optionally delete placeholder if we sent a new message
            if (!editMessage && placeholderMessageId) {
              try {
                await bot.deleteMessage(chatId, placeholderMessageId);
              } catch (err: any) {
                console.warn(`⚠️ Failed to delete placeholder message ${placeholderMessageId}:`, err);
              }
            }

            break;
          }
          // -------------------- Audio message --------------------
          case "audio": {
            if (!msg.audio?.data || !msg.audio?.format) {
              console.warn("⚠️ Missing audio data or format for Telegram:", msg);
              continue;
            }

            // Decode base64 to Buffer
            const audioBuffer = Buffer.from(msg.audio.data, "base64");

            // Convert Buffer to Readable stream
            const audioStream = Readable.from(audioBuffer);

            // Send audio using stream + filename
            await bot.sendVoice(chatId, audioStream, {
              // @ts-expect-error TS doesn't know about filename, but runtime works
              filename: `${response.id}.${msg.audio.format}`,
              disable_notification: true,
              protect_content: true
            });

            break;
          }

          // -------------------- Unsupported --------------------
          default:
            console.warn(`⚠️ Unsupported message type for Telegram: ${msg.type}`);
        }
      } catch (err: any) {
        console.error(`❌ Telegram send error for chatId ${chatId}:`, err);
      }
    }
  }
}