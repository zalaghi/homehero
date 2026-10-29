"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { pdfFilename, savePdfFile } from "@/lib/pdf-download";

function PdfPage({ pdf, pageNumber, label, onError }: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  label: string;
  onError: () => void;
}) {
  const container = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!width || !canvas.current) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    const target = canvas.current;
    async function render() {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / base.width });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      target.width = Math.ceil(viewport.width * ratio);
      target.height = Math.ceil(viewport.height * ratio);
      target.style.width = `${viewport.width}px`;
      target.style.height = `${viewport.height}px`;
      task = page.render({ canvas: target, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
      await task.promise;
      const content = await page.getTextContent();
      if (!cancelled) setText(content.items.map(item => "str" in item ? item.str : "").join(" "));
    }
    void render().catch(() => { if (!cancelled) onError(); });
    return () => { cancelled = true; task?.cancel(); };
  }, [pdf, pageNumber, width, onError]);

  return (
    <figure ref={container} className="relative mx-auto mb-5 w-full max-w-3xl">
      <figcaption className="mb-2 text-center text-xs text-zinc-500 dark:text-zinc-400">{label}</figcaption>
      <canvas ref={canvas} aria-hidden="true" className="block max-w-full bg-white shadow-md" />
      <p className="sr-only">{text}</p>
    </figure>
  );
}

export default function PdfPreviewDialog({ src, onClose }: { src: string; onClose: () => void }) {
  const t = useTranslations("portal.pdfViewer");
  const dialog = useRef<HTMLDialogElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [failed, setFailed] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const renderError = useCallback(() => setFailed(true), []);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let task: PDFDocumentLoadingTask | undefined;
    async function load() {
      const [response, pdfjs] = await Promise.all([
        fetch(src, { credentials: "include", cache: "no-store", signal: controller.signal }),
        import("pdfjs-dist/legacy/build/pdf.mjs"),
      ]);
      if (!response.ok || !response.headers.get("Content-Type")?.includes("application/pdf")) throw new Error("PDF unavailable");
      const bytes = await response.arrayBuffer();
      if (controller.signal.aborted) return;
      const downloadedFile = new File([bytes], pdfFilename(response.headers.get("Content-Disposition")), { type: "application/pdf" });
      pdfjs.GlobalWorkerOptions.workerSrc = `/pdfjs/${pdfjs.version}/pdf.worker.min.mjs`;
      task = pdfjs.getDocument({ data: new Uint8Array(bytes) });
      const document = await task.promise;
      if (controller.signal.aborted) return;
      setFile(downloadedFile);
      setPdf(document);
    }
    void load().catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => { controller.abort(); void task?.destroy().catch(() => {}); };
  }, [src]);

  async function save() {
    if (!file || saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      if (await savePdfFile(file) === "unavailable") setSaveError(true);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="payslip-preview-title" onClose={onClose}
      className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none overflow-hidden border-0 bg-slate-100 p-0 text-zinc-950 backdrop:bg-black/50 dark:bg-zinc-900 dark:text-zinc-50">
      <div className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 border-b border-black/10 bg-white px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] dark:border-white/10 dark:bg-zinc-950">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <h2 id="payslip-preview-title" className="text-base font-semibold">{t("title")}</h2>
            <button type="button" onClick={() => dialog.current?.close()} autoFocus className="min-h-11 shrink-0 rounded-xl border border-black/15 px-4 text-sm font-semibold dark:border-white/20">
              {t("close")}
            </button>
          </div>
          <div className="mx-auto mt-2 flex max-w-3xl items-center justify-between gap-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("hint")}</p>
            <button type="button" onClick={() => void save()} disabled={!file || saving} className="min-h-11 shrink-0 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-40">
              {saving ? t("saving") : t("save")}
            </button>
          </div>
          {saveError && <p role="alert" className="mx-auto mt-2 max-w-3xl text-sm text-red-600 dark:text-red-400">{t("saveError")}</p>}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:px-6" aria-busy={!pdf && !failed}>
          {failed && <p role="alert" className="mx-auto max-w-md rounded-xl bg-white p-5 text-sm dark:bg-zinc-950">{t("error")}</p>}
          {!pdf && !failed && <p role="status" className="p-6 text-center text-sm">{t("loading")}</p>}
          {pdf && Array.from({ length: pdf.numPages }, (_, index) => <PdfPage key={index} pdf={pdf} pageNumber={index + 1} label={t("page", { page: index + 1, count: pdf.numPages })} onError={renderError} />)}
        </div>
      </div>
    </dialog>
  );
}
