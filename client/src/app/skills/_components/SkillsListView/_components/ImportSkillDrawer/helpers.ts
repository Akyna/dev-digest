import type { ImportSkillInput } from "@/lib/hooks/skills";
import { ALLOWED_EXTENSIONS, BASE64_CHUNK_SIZE, MARKDOWN_EXTENSION } from "./constants";

/** Lowercased extension including the dot; "" when the name has none. */
export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot < 0 ? "" : filename.slice(dot).toLowerCase();
}

export function isAllowedFile(filename: string): boolean {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(extensionOf(filename));
}

/** Binary → base64 in chunks, so a large archive doesn't overflow the call stack. */
export function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK_SIZE));
  }
  return btoa(binary);
}

/** Markdown is sent as text; an archive is sent as base64 for the server to
    *inspect*. The client never unpacks an archive — it only hands it over. */
export async function readSkillFile(file: File): Promise<ImportSkillInput> {
  if (extensionOf(file.name) === MARKDOWN_EXTENSION) {
    return { filename: file.name, content: await file.text() };
  }
  return { filename: file.name, content_b64: toBase64(await file.arrayBuffer()) };
}
