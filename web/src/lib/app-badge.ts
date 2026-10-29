type BadgeNavigator = Navigator & { setAppBadge?: (count: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
export async function updateAppBadge(count: number): Promise<void> {
  if (typeof navigator === "undefined" || !Number.isSafeInteger(count) || count < 0) return;
  const badge = navigator as BadgeNavigator;
  try {
    if (count === 0 && badge.clearAppBadge) await badge.clearAppBadge();
    else if (badge.setAppBadge) await badge.setAppBadge(count);
  } catch { /* Notification permissions and badge visibility remain controlled by the OS. */ }
}
