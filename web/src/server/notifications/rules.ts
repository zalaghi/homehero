export type NotificationEmailState = {
  readAt?: Date | string | null;
  clickedAt?: Date | string | null;
  emailSentAt?: Date | string | null;
};

export function shouldSendNotificationEmail(notification: NotificationEmailState): boolean {
  return !notification.readAt && !notification.clickedAt && !notification.emailSentAt;
}
