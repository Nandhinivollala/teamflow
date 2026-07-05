import "server-only";

import { del, put } from "@vercel/blob";
import type { ObjectStorage } from "./storage";

function assertBlobUrl(key: string) {
  const url = new URL(key);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".public.blob.vercel-storage.com")) {
    throw new Error("Invalid Vercel Blob key.");
  }
  return url.toString();
}

export const vercelBlobObjectStorage: ObjectStorage = {
  async put(key, body, contentType) {
    const blob = await put(`teamflow/${key}`, Buffer.from(body), {
      access: "public",
      addRandomSuffix: false,
      contentType,
    });
    return { key: blob.url, contentType, sizeBytes: body.byteLength };
  },
  async get(key) {
    const response = await fetch(assertBlobUrl(key), { cache: "no-store" });
    if (!response.ok) throw new Error("Stored file is unavailable.");
    return new Uint8Array(await response.arrayBuffer());
  },
  async getDownloadUrl(key) {
    return assertBlobUrl(key);
  },
  async delete(key) {
    await del(assertBlobUrl(key));
  },
};
