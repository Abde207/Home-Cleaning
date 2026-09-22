import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type ObjectKind = 'chat' | 'complaint';
export type StoredObject = { key: string; kind: ObjectKind; ownerReference: string; mimeType: string; byteSize: number };
export interface PrivateObjectStore {
  put(kind: ObjectKind, ownerReference: string, mimeType: string, bytes: Buffer): Promise<StoredObject>;
  get(object: StoredObject, authorizedOwnerReference: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export function validateObject(kind: ObjectKind, mimeType: string, bytes: Buffer) {
  const image = (mimeType === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (mimeType === 'image/jpeg' && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])));
  const pdf = mimeType === 'application/pdf' && bytes.subarray(0, 5).toString() === '%PDF-';
  if (!(kind === 'complaint' ? image : image || pdf)) throw new Error('OBJECT_MIME_INVALID');
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error('OBJECT_SIZE_INVALID');
}

export function privateObjectKey(kind: ObjectKind) { return `${kind}/${randomUUID()}`; }

/** Private local fixture store. Access control belongs to the future chat/complaint reference service. */
export class LocalPrivateObjectStore implements PrivateObjectStore {
  constructor(private readonly root: string) {}
  async put(kind: ObjectKind, ownerReference: string, mimeType: string, bytes: Buffer) {
    if (!/^[0-9a-f-]{36}$/i.test(ownerReference)) throw new Error('OBJECT_OWNER_INVALID');
    validateObject(kind, mimeType, bytes);
    const key = privateObjectKey(kind);
    const directory = join(this.root, kind);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(join(this.root, key), bytes, { flag: 'wx', mode: 0o600 });
    return { key, kind, ownerReference, mimeType, byteSize: bytes.length };
  }
  async get(object: StoredObject, authorizedOwnerReference: string) {
    if (object.ownerReference !== authorizedOwnerReference) throw new Error('OBJECT_ACCESS_DENIED');
    if (!/^((chat)|(complaint))\/[0-9a-f-]{36}$/i.test(object.key)) throw new Error('OBJECT_KEY_INVALID');
    return readFile(join(this.root, object.key));
  }
  async delete(_key: string) { throw new Error('OBJECT_RETENTION_POLICY_REQUIRED'); }
}
