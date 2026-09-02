#!/usr/bin/env node
/**
 * CDP helper — điều khiển trang YouTube trong Chromium test (port 9222).
 *
 * Cách dùng:
 *   node scripts/cdp.mjs play          # phát video
 *   node scripts/cdp.mjs pause         # tạm dừng
 *   node scripts/cdp.mjs check         # đọc trạng thái overlay + video + thời gian
 *   node scripts/cdp.mjs seek <giây>   # tua video
 *   node scripts/cdp.mjs eval <js>     # chạy JS tuỳ ý trong trang
 */
const CMD = process.argv[2] ?? 'check';
const ARG = process.argv[3];

const list = await (await fetch('http://localhost:9222/json')).json();
const page = list.find(
  (t) => t.type === 'page' && t.url.includes('youtube.com/watch'),
);
if (!page) {
  console.error('Không tìm thấy tab YouTube. Targets:', list.map((t) => `${t.type}:${t.url}`).join(' | '));
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
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

async function evaluate(expr) {
  const r = await send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) {
    return { __error: r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails) };
  }
  return r.result?.value;
}

const video = `document.querySelector('video')`;
const overlay = `document.querySelector('#live-trans-root')`;

if (CMD === 'play') {
  console.log(await evaluate(`${video}?.play().then(()=>'playing').catch(e=>'play-failed: '+e.message)`));
  console.log('muted=', await evaluate(`${video}?.muted`), 'paused=', await evaluate(`${video}?.paused`), 't=', await evaluate(`${video}?.currentTime`));
} else if (CMD === 'pause') {
  console.log(await evaluate(`${video}?.pause(), 'paused'`));
} else if (CMD === 'seek') {
  console.log(await evaluate(`${video}.currentTime = ${Number(ARG) || 0}; ${video}.play().then(()=>'seek+playing').catch(e=>e.message)`));
} else if (CMD === 'eval') {
  console.log(JSON.stringify(await evaluate(ARG), null, 2));
} else if (CMD === 'check') {
  const state = await evaluate(`(() => {
    const v = document.querySelector('video');
    const root = document.querySelector('#live-trans-root');
    const shadow = root?.shadowRoot;
    const sub = shadow?.querySelector('.lt-sub');
    const title = shadow?.querySelector('.lt-title');
    const subVisible = sub && getComputedStyle(sub).display !== 'none';
    const notice = shadow?.querySelector('.lt-notice');
    return {
      videoFound: !!v,
      playing: v ? !v.paused : null,
      currentTime: v ? Math.round(v.currentTime) : null,
      muted: v?.muted,
      overlayMounted: !!root,
      subtitleVisible: !!subVisible,
      subtitleTranslated: sub?.querySelector('.lt-translated')?.textContent?.slice(0, 160) ?? null,
      subtitleOriginal: sub?.querySelector('.lt-original')?.textContent?.slice(0, 160) ?? null,
      titleTranslated: title?.querySelector('.lt-translated')?.textContent?.slice(0, 100) ?? null,
      notice: notice?.textContent?.slice(0, 160) ?? null,
    };
  })()`);
  console.log(JSON.stringify(state, null, 2));
} else {
  console.log('Lệnh không rõ:', CMD);
}

ws.close();
process.exit(0);
