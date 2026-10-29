export function pdfFilename(disposition: string | null): string {
  const name = disposition?.match(/filename="([A-Za-z0-9._-]+\.pdf)"/i)?.[1];
  return name ?? "HomeHero-payslip.pdf";
}

export async function savePdfFile(file: File): Promise<"saved" | "cancelled" | "unavailable"> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      // Called by a second, explicit tap after the file is ready: preserves user activation on iOS.
      await navigator.share({ files: [file], title: file.name });
      return "saved";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return "cancelled";
      throw error;
    }
  }

  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // iOS may replace the entire standalone app with an unclosable native PDF preview.
  if (isIos) return "unavailable";

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "saved";
}
