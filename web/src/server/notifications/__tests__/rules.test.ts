import { describe, it, expect } from "vitest";
import { shouldSendNotificationEmail } from "../rules";

describe("shouldSendNotificationEmail", () => {
  it("allows sending when unread and not clicked", () => {
    expect(shouldSendNotificationEmail({ readAt: null, clickedAt: null, emailSentAt: null })).toBe(true);
  });

  it("skips when already read", () => {
    expect(shouldSendNotificationEmail({ readAt: new Date(), clickedAt: null, emailSentAt: null })).toBe(false);
  });

  it("skips when clicked", () => {
    expect(shouldSendNotificationEmail({ readAt: null, clickedAt: new Date(), emailSentAt: null })).toBe(false);
  });

  it("skips when email already sent", () => {
    expect(shouldSendNotificationEmail({ readAt: null, clickedAt: null, emailSentAt: new Date() })).toBe(false);
  });
});
