import { headers } from "next/headers";
import { isAllowedOrigin } from "./origin";
export async function assertSameOrigin(): Promise<void> {
  if (!isAllowedOrigin(await headers())) throw new Error("CSRF: origin mismatch");
}
