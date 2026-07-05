import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ObjectStorage } from "./storage";

const root = path.resolve(process.cwd(), "storage", "uploads");

function resolveKey(key: string) {
  const target = path.resolve(root, key);
  if (!target.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid storage key.");
  }
  return target;
}

export const localObjectStorage: ObjectStorage = {
  async put(key, body, contentType) {
    const target = resolveKey(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
    return { key, contentType, sizeBytes: body.byteLength };
  },
  async get(key) {
    return readFile(resolveKey(key));
  },
  async getDownloadUrl(key) {
    return `/api/attachments/by-key?key=${encodeURIComponent(key)}`;
  },
  async delete(key) {
    await rm(resolveKey(key), { force: true });
  },
};
