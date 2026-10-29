export type OtpProviderName = "DEV" | "SMTP" | "TWILIO_VERIFY" | "TELEGRAM_GATEWAY";

export type OtpSendContext = {
  locale: string;
  purpose: "EMPLOYEE_LOGIN";
  employeePublicId?: string;
};

export type OtpSendResult = {
  challengeId: string;
};

export interface OtpProvider {
  name: OtpProviderName;
  sendCode(recipient: string, ctx: OtpSendContext): Promise<OtpSendResult>;
  verifyCode(challengeId: string, code: string, recipient: string): Promise<boolean>;
}

