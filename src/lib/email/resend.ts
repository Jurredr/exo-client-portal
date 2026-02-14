import { Resend } from "resend";

/**
 * Resend client for sending transactional emails.
 * For Supabase Auth (magic links), configure SMTP in Supabase Dashboard instead.
 */
export function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY is not set - email sending will be disabled");
    return null;
  }
  return new Resend(apiKey);
}
