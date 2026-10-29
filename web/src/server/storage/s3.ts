import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";
import { Readable } from "node:stream";

let s3Client: S3Client | null = null;
let s3PresignClient: S3Client | null = null;

export function resetS3ClientCache(): void {
  s3Client = null;
  s3PresignClient = null;
}

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing ${key}`);
  return value;
}

export function getS3Client(): S3Client {
  if (s3Client) return s3Client;

  const region = getRequiredEnv("S3_REGION");
  const endpoint = process.env.S3_ENDPOINT;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";
  const accessKeyId = getRequiredEnv("S3_ACCESS_KEY_ID");
  const secretAccessKey = getRequiredEnv("S3_SECRET_ACCESS_KEY");

  s3Client = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });
  return s3Client;
}

function getS3PresignClient(): S3Client {
  if (s3PresignClient) return s3PresignClient;

  const region = getRequiredEnv("S3_REGION");
  const endpoint = process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";
  const accessKeyId = getRequiredEnv("S3_ACCESS_KEY_ID");
  const secretAccessKey = getRequiredEnv("S3_SECRET_ACCESS_KEY");

  s3PresignClient = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });
  return s3PresignClient;
}

export function generateDocumentStorageKey(employeeId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const suffix = crypto.randomBytes(8).toString("hex");
  return `employees/${employeeId}/${suffix}/${safeName}`;
}

export async function createPresignedUploadUrl(input: {
  key: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds?: number;
  serverSideEncryption?: "AES256";
}): Promise<string> {
  const bucket = getRequiredEnv("S3_BUCKET");
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: input.key,
    ContentType: input.contentType,
    ContentLength: input.contentLength,
    ...(input.serverSideEncryption ? { ServerSideEncryption: input.serverSideEncryption } : {}),
  });
  return getSignedUrl(client, command, { expiresIn: input.expiresInSeconds ?? 600 });
}

export async function createPresignedDownloadUrl(input: {
  key: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const bucket = getRequiredEnv("S3_BUCKET");
  const client = getS3PresignClient();
  const command = new GetObjectCommand({ Bucket: bucket, Key: input.key });
  return getSignedUrl(client, command, { expiresIn: input.expiresInSeconds ?? 300 });
}

export async function getPresignedDownloadUrl(key: string): Promise<string> {
  return createPresignedDownloadUrl({ key });
}

export async function uploadObject(input: {
  key: string;
  contentType?: string;
  body: Buffer | Uint8Array | string;
  serverSideEncryption?: "AES256";
}): Promise<void> {
  const bucket = getRequiredEnv("S3_BUCKET");
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType,
    ...(input.serverSideEncryption ? { ServerSideEncryption: input.serverSideEncryption } : {}),
  });
  await client.send(command);
}

export async function deleteObject(key: string): Promise<void> {
  const bucket = getRequiredEnv("S3_BUCKET");
  const client = getS3Client();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function getObjectStream(key: string): Promise<{
  body: ReadableStream | null;
  contentType?: string;
  contentLength?: number;
}> {
  const bucket = getRequiredEnv("S3_BUCKET");
  const client = getS3Client();
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const nodeStream = result.Body;
  const body =
    typeof nodeStream?.transformToWebStream === "function"
      ? nodeStream.transformToWebStream()
      : nodeStream
        ? (Readable.toWeb(nodeStream as Readable) as ReadableStream)
        : null;

  return { body, contentType: result.ContentType, contentLength: result.ContentLength };
}
