import dotenv from "dotenv";

/**
 * Determine the current environment.
 * Defaults to 'development' if APP_ENV is not set.
 */
export const APP_ENV = process.env.APP_ENV || "development";

/**
 * Load .env file only in development to avoid accidentally overwriting production environment.
 */
if (APP_ENV === "development") {
  dotenv.config();
  console.log("[config.ts] Loaded local .env file for development");
} else {
  console.log(`[config.ts] Using system environment for: ${APP_ENV}`);
}

/**
 * Safe helper to fetch required environment variables.
 * Logs a warning if the variable is missing and not optional.
 *
 * @param key Environment variable name
 * @param optional If true, missing value will not log a warning
 * @returns The environment variable value or undefined
 */
function requireEnv(key: string, optional = false): string | undefined {
  const value = process.env[key];
  if (!value && !optional) {
    console.warn(`[config.ts] ⚠️ Missing environment variable: ${key}`);
  }
  return value;
}

/**
 * Centralized configuration object.
 * Add new environment variables here as needed.
 */
export const CONFIG = {
  APP_ENV,
  IS_VERCEL: process.env.VERCEL === "1",
  PORT: process.env.PORT || 3000,
  TELEGRAM_BOT_TOKEN: requireEnv("TELEGRAM_BOT_TOKEN"),
  AGENTS_API_KEY: requireEnv("AGENTS_API_KEY"),
  TELEGRAM_SECRET: requireEnv("TELEGRAM_SECRET"),
  API_KEY: requireEnv("API_KEY"),
  // BASE_URL: requireEnv("BASE_URL")
    // ? `https://${process.env.BASE_URL}`
    // : process.env.VERCEL_URL
    //     ? `https://${process.env.VERCEL_URL}`
    //     : `http://localhost:${process.env.PORT || 3000}`,
};