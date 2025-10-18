export type IntegrationType = 'telegram' | 'watch-app' | string;
export type MessageType = 'text' | 'audio';

export interface OutgoingMessage {
  type: MessageType;
  content: string;
  placeholderMessageId?: string | number;
  options?: Options;
  audio?: Audio;
}

export interface Audio {
  data: string;
  format: string;
}

export interface Options {
  parseMode?: string;
  [key: string]: any;
}

export interface OutgoingRecipient {
  channel: IntegrationType;      // which integration/channel to send to
  id?: string | number;
  userId?: string | number;      // user ID from the event
  chatId?: string | number;
  messageId?: string | number;
}

export interface Response {
  id?: string;                     // event ID
  recipients: OutgoingRecipient[]; // array of recipients
  messages: OutgoingMessage[];
  metadata?: Record<string, any>;  // e.g., agentId, source info
}
