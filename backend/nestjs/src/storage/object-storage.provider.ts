import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type ObjectKind = 'chat' | 'complaint';
export type StoredObject = { key: string; kind: ObjectKind; ownerReference: string; mimeType: string; byteSize: number };
export interface PrivateObjectStore {
  put(kind: ObjectKind, ownerReference: string, mimeType: string, bytes: Buffer): Promise<StoredObject>;
  get(object: StoredObject, authorizedOwnerReference: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

function validKey(key: string) { return /^((chat)|(complaint))\/[0-9a-f-]{36}$/i.test(key); }

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
    if (!validKey(object.key)) throw new Error('OBJECT_KEY_INVALID');
    return readFile(join(this.root, object.key));
  }
  async delete(key: string) {
    if (!validKey(key)) throw new Error('OBJECT_KEY_INVALID');
    await rm(join(this.root, key), { force: true });
  }
}

type AccessClaim = StoredObject & { expiresAt: number };

/** Short-lived private capability. A domain service must verify ownership before issuing it. */
export class PrivateObjectAccess {
  constructor(private readonly store: PrivateObjectStore, private readonly secret: string) {
    if (secret.length < 32) throw new Error('OBJECT_ACCESS_SECRET_INVALID');
  }
  issue(object: StoredObject, authorizedOwnerReference: string, ttlSeconds = 300) {
    if (object.ownerReference !== authorizedOwnerReference) throw new Error('OBJECT_ACCESS_DENIED');
    if (!validKey(object.key) || !Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 900)
      throw new Error('OBJECT_ACCESS_INVALID');
    const payload = Buffer.from(JSON.stringify({ ...object, expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url');
    const signature = createHmac('sha256', this.secret).update(payload).digest('base64url');
    return `${payload}.${signature}`;
  }
  async read(token: string) {
    const [payload, encodedSignature, extra] = token.split('.');
    if (!payload || !encodedSignature || extra) throw new Error('OBJECT_ACCESS_INVALID');
    const expected = createHmac('sha256', this.secret).update(payload).digest();
    let signature: Buffer;
    try { signature = Buffer.from(encodedSignature, 'base64url'); } catch { throw new Error('OBJECT_ACCESS_INVALID'); }
    if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) throw new Error('OBJECT_ACCESS_INVALID');
    let claim: AccessClaim;
    try { claim = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AccessClaim; }
    catch { throw new Error('OBJECT_ACCESS_INVALID'); }
    if (!Number.isInteger(claim.expiresAt) || claim.expiresAt <= Math.floor(Date.now() / 1000)) throw new Error('OBJECT_ACCESS_EXPIRED');
    if (!validKey(claim.key) || !['chat', 'complaint'].includes(claim.kind) || !/^[0-9a-f-]{36}$/i.test(claim.ownerReference) ||
        typeof claim.mimeType !== 'string' || !Number.isInteger(claim.byteSize) || claim.byteSize < 1)
      throw new Error('OBJECT_ACCESS_INVALID');
    return this.store.get(claim, claim.ownerReference);
  }
}
