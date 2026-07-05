import "server-only";

import { localObjectStorage } from "./local-storage";
import { vercelBlobObjectStorage } from "./vercel-blob-storage";

export const objectStorage =
  process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN
  ? vercelBlobObjectStorage
  : localObjectStorage;
