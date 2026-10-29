import type { OtpProvider } from "./types";
import { DevOtpProvider } from "./devProvider";
import { SmtpOtpProvider } from "./smtpProvider";

export function getOtpProvider(): OtpProvider {
  const name = (process.env.OTP_PROVIDER ?? "DEV").toUpperCase();
  if (name === "DEV") return new DevOtpProvider();
  if (name === "SMTP") return new SmtpOtpProvider();

  // Stubs for production providers (implementation comes next)
  if (name === "TWILIO_VERIFY" || name === "TELEGRAM_GATEWAY") {
    throw new Error(`${name} provider not implemented yet`);
  }

  throw new Error(`Unknown OTP_PROVIDER: ${name}`);
}

