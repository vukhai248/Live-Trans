#!/usr/bin/env node
/**
 * CDP → extension service worker: kiểm tra + khởi động phiên dịch từ script.
 *   node scripts/cdp-ext.mjs status    # đọc settings + trạng thái SW
 *   node scripts/cdp-ext.mjs start     # xin streamId + gửi START_CAPTURE tới offscreen
 *   node scripts/cdp-ext.mjs stop
 *   node scripts/cdp-ext.mjs state     # GET_STATE qua runtime messaging
 */
const CMD = process.argv[2] ?? 'status';

const list = await (await fetch('http://localhost:9222/json')).json();
const sw = list.find((t) => t.type === 'service_worker' && t.url.includes('background'));
if (!sw) {
  console.error(
    'Không thấy service worker. Targets:',
    list.map((t) => `${t.type}:${t.url.slice(0, 80)}`).join(' | '),
  );
  process.exit(1);
}

const ws = new WebSocket(sw.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
};

async function evaluate(expr, awaitPromise = true) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise });
  if (r.exceptionDetails) {
    return { __error: r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails) };
  }
  return r.result?.value;
}

if (CMD === 'status') {
  console.log(
    JSON.stringify(
      await evaluate(`(async () => {
        const stored = await chrome.storage.local.get('live-trans:settings');
        const s = stored['live-trans:settings'];
        return { mode: s?.mode, keyPrefix: s?.apiKey?.slice(0, 6) ?? null, keyLen: s?.apiKey?.length ?? 0, targetLang: s?.targetLang, chunkSeconds: s?.chunkSeconds, glossaryTerms: s?.glossary?.terms?.length ?? 0 };
      })()`),
      null,
      2,
    ),
  );
} else if (CMD === 'start') {
  console.log(
    JSON.stringify(
      await evaluate(`(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return { error: 'no active tab' };
        let streamId;
        try {
          streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
        } catch (e) {
          return { error: 'getMediaStreamId: ' + e.message, tabId: tab.id };
        }
        const stored = await chrome.storage.local.get('live-trans:settings');
        chrome.runtime.sendMessage({ type: 'START_CAPTURE', streamId, tabId: tab.id, settings: stored['live-trans:settings'] }).catch(() => {});
        return { ok: true, tabId: tab.id, streamIdLen: streamId?.length ?? 0 };
      })()`),
      null,
      2,
    ),
  );
} else if (CMD === 'stop') {
  console.log(JSON.stringify(await evaluate(`(chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' }).catch(() => {}), 'sent')`)));
} else if (CMD === 'state') {
  console.log(JSON.stringify(await evaluate(`(async () => {
    const snap = await chrome.runtime.sendMessage({ type: 'GET_SUBTITLES' }).catch(e => ({ error: String(e) }));
    return snap;
  })()`), null, 2).slice(0, 3000));
}

ws.close();
process.exit(0);
