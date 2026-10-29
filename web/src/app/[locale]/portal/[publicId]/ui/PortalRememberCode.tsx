"use client";

import { useEffect } from "react";

const STORAGE_KEY = "portalPublicId";

export default function PortalRememberCode({ publicId }: { publicId: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!publicId) return;
    window.localStorage.setItem(STORAGE_KEY, publicId);
  }, [publicId]);

  return null;
}
