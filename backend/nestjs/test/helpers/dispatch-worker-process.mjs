import 'reflect-metadata';
import { createApp } from '../../dist/bootstrap.js';
import { DispatchService } from '../../dist/dispatch/dispatch.service.js';
import { DispatchWorker } from '../../dist/dispatch/dispatch.worker.js';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const bridge = process.env.DISPATCH_EXTERNAL_WORKERS_DIR;
const workerId = process.env.DISPATCH_PROCESS_TEST_ID;
const eventFile = bridge && workerId ? join(bridge, `events-${workerId}.jsonl`) : null;
const commandFile = bridge && workerId ? join(bridge, `commands-${workerId}.jsonl`) : null;
function emit(message) {
  if (eventFile) appendFileSync(eventFile, `${JSON.stringify(message)}\n`);
  else process.send?.(message);
}

const app = await createApp();
const dispatch = app.get(DispatchService);
const worker = app.get(DispatchWorker);
const original = dispatch.systemOffer.bind(dispatch);
dispatch.systemOffer = async bookingId => {
  emit({ type: 'processing', bookingId, pid: process.pid });
  if (process.env.DISPATCH_PROCESS_TEST_MODE === 'park') await new Promise(() => {});
  try {
    const result = await original(bookingId);
    emit({ type: 'offer-result', bookingId, ok: true, status: result.status, pid: process.pid });
    return result;
  } catch (error) {
    emit({ type: 'offer-result', bookingId, ok: false, error: error instanceof Error ? error.message : String(error), pid: process.pid });
    throw error;
  }
};
await app.init();
emit({ type: 'ready', pid: process.pid });
async function onCommand(message) {
  if (message?.type === 'sweep') {
    try { emit({ type: 'sweep-result', bookingId: message.bookingId, result: await worker.runOnce(message.bookingId), pid: process.pid }); }
    catch (error) { emit({ type: 'sweep-error', bookingId: message.bookingId, error: error instanceof Error ? error.message : String(error), pid: process.pid }); }
  }
  if (message?.type === 'stop') {
    await app.close();
    process.exit(0);
  }
}
if (commandFile) {
  let consumed = 0;
  setInterval(() => {
    if (!existsSync(commandFile)) return;
    const lines = readFileSync(commandFile, 'utf8').trim().split('\n').filter(Boolean);
    for (const line of lines.slice(consumed)) void onCommand(JSON.parse(line));
    consumed = lines.length;
  }, 100);
} else process.on('message', message => { void onCommand(message); });
