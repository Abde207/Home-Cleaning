import test from 'node:test';
import assert from 'node:assert/strict';
import { privateObjectKey, validateObject, LocalPrivateObjectStore } from '../../dist/storage/object-storage.provider.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

test('private keys contain no filename or traversal input', () => {
  const key = privateObjectKey('chat');
  assert.match(key, /^chat\/[0-9a-f-]{36}$/);
  assert.ok(!key.includes('..'));
});

test('private local objects require their owner reference and reject invalid keys', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'homeclean-object-test-'));
  try {
    const store = new LocalPrivateObjectStore(directory);
    const owner = randomUUID();
    const object = await store.put('chat', owner, 'image/jpeg', Buffer.from([255, 216, 255, 1]));
    await assert.rejects(store.get(object, randomUUID()), /OBJECT_ACCESS_DENIED/);
    await assert.rejects(store.get({ ...object, key: '../outside' }, owner), /OBJECT_KEY_INVALID/);
    assert.deepEqual(await store.get(object, owner), Buffer.from([255, 216, 255, 1]));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('complaint objects accept images only and enforce content bytes', () => {
  assert.doesNotThrow(() => validateObject('complaint', 'image/jpeg', Buffer.from([255, 216, 255, 1])));
  assert.throws(() => validateObject('complaint', 'application/pdf', Buffer.from('%PDF-')), /OBJECT_MIME_INVALID/);
  assert.throws(() => validateObject('chat', 'image/jpeg', Buffer.from('not a jpeg')), /OBJECT_MIME_INVALID/);
  assert.throws(() => validateObject('chat', 'image/jpeg', Buffer.concat([Buffer.from([255, 216, 255]), Buffer.alloc(11 * 1024 * 1024)])), /OBJECT_SIZE_INVALID/);
});
