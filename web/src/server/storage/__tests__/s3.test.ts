import { describe, expect, it, beforeEach } from "vitest";
import {
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  generateDocumentStorageKey,
  resetS3ClientCache,
} from "@/server/storage/s3";

const defaultEnv = { ...process.env };

describe("S3 presigned helpers", () => {
  beforeEach(() => {
    process.env = { ...defaultEnv };
    process.env.S3_REGION = "us-east-1";
    process.env.S3_ENDPOINT = "http://example-s3.local:9000";
    process.env.S3_ACCESS_KEY_ID = "test-access";
    process.env.S3_SECRET_ACCESS_KEY = "test-secret";
    process.env.S3_BUCKET = "pam";
    process.env.S3_FORCE_PATH_STYLE = "true";
    resetS3ClientCache();
  });

  it("generates a stable storage key format", () => {
    const key = generateDocumentStorageKey("emp_123", "Contract (v1).pdf");
    expect(key.startsWith("employees/emp_123/")).toBe(true);
    expect(key.endsWith("/Contract__v1_.pdf")).toBe(true);
  });

  it("issues an upload URL with SSE and signed headers", async () => {
    const key = generateDocumentStorageKey("emp_123", "ssn.png");
    const url = await createPresignedUploadUrl({
      key,
      contentType: "image/png",
      contentLength: 1024,
      expiresInSeconds: 600,
      serverSideEncryption: "AES256",
    });

    const parsed = new URL(url);
    expect(parsed.hostname).toContain("example-s3.local");
    expect(parsed.pathname).toContain(`/pam/${key}`);
    expect(parsed.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(parsed.searchParams.get("X-Amz-Signature")).toBeTruthy();
    const signedHeaders = parsed.searchParams.get("X-Amz-SignedHeaders") ?? "";
    expect(signedHeaders).toContain("content-length");
    expect(signedHeaders).toContain("x-amz-server-side-encryption");
  });

  it("issues a short-lived download URL", async () => {
    const key = generateDocumentStorageKey("emp_999", "payslip.pdf");
    const url = await createPresignedDownloadUrl({ key, expiresInSeconds: 120 });
    const parsed = new URL(url);
    expect(parsed.pathname).toContain(`/pam/${key}`);
    expect(parsed.searchParams.get("X-Amz-Expires")).toBe("120");
    expect(parsed.searchParams.get("X-Amz-Signature")).toBeTruthy();
  });
});
