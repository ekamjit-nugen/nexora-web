/**
 * Chatbot's cross-module surface. Right now nothing else calls into
 * the chatbot (it's a leaf consumer), so this is a minimal stub that
 * keeps the module template consistent. Future use: other modules
 * could fire-and-forget messages to the bot, or subscribe to its
 * domain events ("user asked about payroll" → log for analytics).
 */
export interface ChatbotPublicApi {
  /** Whether the chatbot is reachable (ollama healthcheck). */
  isHealthy(): Promise<boolean>;
}

export const CHATBOT_PUBLIC_API = Symbol('CHATBOT_PUBLIC_API');
