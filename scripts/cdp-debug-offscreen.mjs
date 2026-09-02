#!/usr/bin/env node
/**
 * Debug offscreen document: nghe console logs + network requests trong N giây.
 *   node scripts/cdp-debug-offscreen.mjs [seconds]
 */
const SECONDS = Number(process.argv[2] ?? 60);

const list = await (await fetch('http://localhost:9222/json')).json();
const off = list.find((t) => t.url.includes('offscreen.html'));
if (!off) {
  console.error('KHÔNG THẤY offscreen target! Targets:', list.map((t) => `${t.type}:${t.url.slice(0, 60)}`).join(' | '));
  process.exit(1);
}
console.log('offscreen found:', off.url);

const ws = new WebSocket(off.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const m = ++id;
    pending.set(m, { resolve, reject });
    ws.send(JSON.stringify({ id: m, method, params }));
  });
}
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
    return;
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    const args = (msg.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ');
    console.log(`[console.${msg.params.type}] ${args.slice(0, 300)}`);
  } else if (msg.method === 'Network.requestWillBeSent') {
    console.log(`[net] ${msg.params.request.method} ${msg.params.request.url.slice(0, 120)}`);
  } else if (msg.method === 'Network.responseReceived') {
    console.log(`[resp] ${msg.params.response.status} ${msg.params.response.url.slice(0, 120)}`);
  } else if (msg.method === 'Network.loadingFailed') {
    console.log(`[net-fail] ${msg.params.errorText} ${msg.params.type ?? ''}`);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    console.log(`[EXC] ${msg.params.exceptionDetails?.exception?.description?.slice(0, 300) ?? JSON.stringify(msg.params.exceptionDetails).slice(0, 200)}`);
  }
};

await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');
await send('Network.enable');
console.log(`listening ${SECONDS}s...`);
await new Promise((r) => setTimeout(r, SECONDS * 1000));
console.log('done');
ws.close();
process.exit(0);
