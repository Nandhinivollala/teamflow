export type StoredObject = {
  key: string;
  contentType: string;
  sizeBytes: number;
};

export interface ObjectStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<StoredObject>;
  get(key: string): Promise<Uint8Array>;
  getDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}
