// src/integrations/dispatcher.ts
import { Response } from "../models/Response.js";
import { sendTelegramResponse } from "./telegram/client.js";

export async function dispatchResponse(response: Response) {
  const tasks: Promise<void>[] = [];

  for (const recipient of response.recipients) {
    switch (recipient.channel) {
      case "telegram":
        tasks.push(sendTelegramResponse(response, recipient));
        break;

      // Add other integrations here as needed
      // case "watch-app":
      //   tasks.push(sendWatchAppResponse(response, recipient));
      //   break;

      default:
        console.warn(`⚠️ Unknown or unsupported channel: ${recipient.channel}`);
    }
  }

  await Promise.all(tasks);
}
