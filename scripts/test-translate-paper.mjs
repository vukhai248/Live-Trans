import fs from 'node:fs';
import path from 'node:path';

const CDP_HOST = '127.0.0.1';
const CDP_PORT = 9222;
const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\4bc61129-69a5-44c1-aa2b-8cdeaddd5d68';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = ++this.id;
      this.pending.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  }

  async screenshot(outputPath) {
    const res = await this.send('Page.captureScreenshot', {
      format: 'png',
      quality: 90,
      fromSurface: true,
    });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(outputPath, buffer);
    console.log(`[Screenshot saved] -> ${outputPath}`);
  }

  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

async function getTargets() {
  try {
    const res = await fetch(`http://${CDP_HOST}:${CDP_PORT}/json`);
    return await res.json();
  } catch (e) {
    return [];
  }
}

async function main() {
  console.log('Connecting to Chrome CDP on 127.0.0.1:9222...');
  let targets = [];
  for (let i = 0; i < 20; i++) {
    targets = await getTargets();
    if (targets.length > 0) break;
    await sleep(1000);
  }

  console.log(`Found ${targets.length} targets:`);
  for (const t of targets) {
    console.log(` - [${t.type}] ${t.url}`);
  }

  // Find our extension ID from service_worker
  const swTarget = targets.find(
    (t) => t.type === 'service_worker' && t.url.includes('chrome-extension://')
  );
  if (!swTarget) {
    console.error('Service worker of Live-Trans not found!');
    process.exit(1);
  }
  const extId = new URL(swTarget.url).hostname;
  console.log(`Detected Live-Trans Extension ID: ${extId}`);

  // 1. Look for viewer tab
  let viewerTarget = targets.find(
    (t) => t.url.includes('viewer.html') && t.url.includes(extId)
  );

  if (!viewerTarget) {
    const arxivTarget = targets.find((t) => t.url.includes('arxiv.org') || t.url.includes('2302.07121'));
    if (arxivTarget) {
      console.log(`Connecting to arXiv tab (${arxivTarget.url})...`);
      try {
        const arxivCdp = new CdpClient(arxivTarget.webSocketDebuggerUrl);
        await arxivCdp.connect();

        // Check for button
        let btnBox = null;
        for (let i = 0; i < 6; i++) {
          try {
            btnBox = await arxivCdp.evaluate(`(() => {
              const btn = document.getElementById('lt-translate-now-btn');
              if (!btn) return null;
              const r = btn.getBoundingClientRect();
              return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            })()`);
            if (btnBox) break;
          } catch {}
          await sleep(1000);
        }

        if (btnBox) {
          console.log(`Found button at (${btnBox.x}, ${btnBox.y}). Dispatching real click...`);
          await arxivCdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: btnBox.x, y: btnBox.y });
          await arxivCdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: btnBox.x, y: btnBox.y, button: 'left', clickCount: 1 });
          await arxivCdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: btnBox.x, y: btnBox.y, button: 'left', clickCount: 1 });
        }
        arxivCdp.close();
      } catch (err) {
        console.log('Error interacting with arxiv tab:', err.message);
      }
    }

    // Wait up to 5s to see if click opened viewer tab
    for (let i = 0; i < 5; i++) {
      await sleep(1000);
      targets = await getTargets();
      viewerTarget = targets.find((t) => t.url.includes('viewer.html') && t.url.includes(extId));
      if (viewerTarget) break;
    }

    // Fallback: Open viewer tab directly with our extension ID
    if (!viewerTarget) {
      console.log('Opening viewer tab directly with Live-Trans extension ID...');
      const targetPdf = 'https://arxiv.org/pdf/2302.07121.pdf';
      const openUrl = `chrome-extension://${extId}/viewer.html?url=${encodeURIComponent(targetPdf)}`;
      try {
        const res = await fetch(`http://${CDP_HOST}:${CDP_PORT}/json/new?${encodeURIComponent(openUrl)}`, { method: 'PUT' });
        viewerTarget = await res.json();
        console.log('Opened viewer target:', viewerTarget.url);
      } catch (err) {
        console.log('PUT /json/new error:', err.message);
      }
    }

    // Wait for viewer tab to appear in targets list
    for (let i = 0; i < 15; i++) {
      if (viewerTarget && viewerTarget.webSocketDebuggerUrl) break;
      await sleep(1000);
      targets = await getTargets();
      viewerTarget = targets.find((t) => t.url.includes('viewer.html') && t.url.includes(extId));
      if (viewerTarget) break;
    }
  }

  if (!viewerTarget) {
    console.error('Failed to find or open viewer tab!');
    process.exit(1);
  }

  console.log('Viewer tab is active:', viewerTarget.url);
  const viewerCdp = new CdpClient(viewerTarget.webSocketDebuggerUrl);
  await viewerCdp.connect();

  // Clear stale session cache
  try {
    await viewerCdp.evaluate('sessionStorage.clear()');
    console.log('Cleared sessionStorage cache.');
  } catch {}

  console.log('Waiting for Page 1 to render and translate...');
  for (let i = 0; i < 35; i++) {
    await sleep(2000);
    try {
      const status = await viewerCdp.evaluate(`(() => {
        const title = document.querySelector('.lt-doc-title')?.textContent || '';
        const badges = Array.from(document.querySelectorAll('.lt-status-badge, .lt-progress-pill, [class*="status"]')).map(el => el.textContent.trim());
        const canvases = document.querySelectorAll('canvas').length;
        const textBlocks = document.querySelectorAll('.lt-trans-block, .lt-sentence, [data-sentence-id]').length;
        const page1 = document.querySelector('.lt-whiteboard-page[data-page-number="1"], .lt-page-wrap[data-page-number="1"]');
        const page1Blocks = page1 ? page1.querySelectorAll('.lt-sentence, .lt-trans-block, [data-sentence-id]').length : 0;
        const bodySnippet = document.body.innerText.slice(0, 300).replace(/\\n+/g, ' ');
        return { title, canvases, textBlocks, page1Blocks, badges, bodySnippet };
      })()`);

      console.log(`[Check ${i + 1}]: Canvases=${status.canvases}, TotalBlocks=${status.textBlocks}, Page1Blocks=${status.page1Blocks}, Badges=[${status.badges.join(' | ')}]`);

      if (status.page1Blocks > 10 || (status.canvases > 0 && i > 15)) {
        console.log('Page 1 rendered & translated! Waiting 4s for typography & KaTeX...');
        await sleep(4000);
        break;
      }
    } catch (err) {
      console.log(`[Check ${i + 1}] Evaluate error:`, err.message);
    }
  }

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });


  // Helper to change split ratio
  const setSplitRatio = async (ratio) => {
    console.log(`Setting split ratio to ${ratio}...`);
    await viewerCdp.evaluate(`((targetRatio) => {
      if (typeof window.__setSplitRatio === 'function') {
        window.__setSplitRatio(targetRatio);
      } else {
        const btns = Array.from(document.querySelectorAll('.lt-toolbar button'));
        const label = targetRatio === 0.35 ? '35:65' : (targetRatio === 0.5 ? '50:50' : '30:70');
        const b = btns.find(btn => btn.textContent.trim() === label);
        if (b) b.click();
      }
    })(${ratio})`);
    await sleep(2000);
  };

  // 1. Capture Page 1 at 50:50 split
  await setSplitRatio(0.50);
  const ss1Path = path.join(ARTIFACT_DIR, 'screen_whiteboard_p1_50_50.png');
  await viewerCdp.screenshot(ss1Path);
  console.log(`Successfully captured Page 1 (Default Split 50:50): ${ss1Path}`);

  // 2. Expand whiteboard to 65% (split ratio 0.35)
  console.log('Expanding Whiteboard to 35:65...');
  await setSplitRatio(0.35);
  const ss1WidePath = path.join(ARTIFACT_DIR, 'screen_whiteboard_p1_35_65.png');
  await viewerCdp.screenshot(ss1WidePath);
  console.log(`Successfully captured Page 1 (Wide 35:65): ${ss1WidePath}`);

  // 2b. Scroll down to show Figure 1 (dog + walker hound) on Page 1
  console.log('Scrolling to Figure 1 on Page 1...');
  await viewerCdp.evaluate(`(() => {
    const left = document.querySelector('.lt-pane-left');
    if (left) left.scrollTop = 380;
  })()`);
  await sleep(2500);
  const ss1FigPath = path.join(ARTIFACT_DIR, 'screen_whiteboard_p1_figure.png');
  await viewerCdp.screenshot(ss1FigPath);
  console.log(`Successfully captured Page 1 Figure 1: ${ss1FigPath}`);

  // 2c. Open Settings Modal & capture
  console.log('Opening Settings Modal...');
  await viewerCdp.evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const sBtn = btns.find(b => b.textContent.includes('Cài đặt'));
    if (sBtn) sBtn.click();
  })()`);
  await sleep(1500);
  const ssSettingsPath = path.join(ARTIFACT_DIR, 'screen_settings_modal.png');
  await viewerCdp.screenshot(ssSettingsPath);
  console.log(`Successfully captured Settings Modal: ${ssSettingsPath}`);

  // Close Settings Modal
  await viewerCdp.evaluate(`(() => {
    const closeBtn = document.querySelector('.lt-modal-close-btn');
    if (closeBtn) closeBtn.click();
  })()`);
  await sleep(1000);

  // 3. Scroll to Page 2
  console.log('Scrolling to Page 2...');
  await viewerCdp.evaluate(`(() => {
    const p2Left = document.querySelector('.lt-pane-left .lt-page-wrap[data-page-number="2"]');
    if (p2Left) {
      p2Left.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  })()`);

  console.log('Waiting for Page 2 to render and translate...');
  for (let i = 0; i < 25; i++) {
    await sleep(2000);
    try {
      const p2Status = await viewerCdp.evaluate(`(() => {
        const p2 = document.querySelector('.lt-whiteboard-page[data-page-number="2"], .lt-page-wrap[data-page-number="2"]');
        const p2Blocks = p2 ? p2.querySelectorAll('.lt-sentence, .lt-trans-block, [data-sentence-id]').length : 0;
        return { p2Found: !!p2, p2Blocks };
      })()`);
      console.log(`[Page 2 Check ${i + 1}]: p2Blocks=${p2Status.p2Blocks}`);
      if (p2Status.p2Blocks > 10 || i > 12) {
        console.log('Page 2 rendered! Waiting 4s for typography & snippets...');
        await sleep(4000);
        break;
      }
    } catch (err) {
      console.log(`[Page 2 Check ${i + 1}] Error:`, err.message);
    }
  }

  // 4. Capture Page 2 Top (Wide 35:65)
  const ss2WidePath = path.join(ARTIFACT_DIR, 'screen_whiteboard_p2_35_65.png');
  await viewerCdp.screenshot(ss2WidePath);
  console.log(`Successfully captured Page 2 (Wide 35:65): ${ss2WidePath}`);

  // 5. Scroll down to show equations (1), (2), (3) on Page 2
  console.log('Scrolling down to equations (1), (2), (3)...');
  await viewerCdp.evaluate(`(() => {
    const left = document.querySelector('.lt-pane-left');
    const p2Left = document.querySelector('.lt-pane-left .lt-page-wrap[data-page-number="2"]');
    if (left && p2Left) {
      left.scrollTop = p2Left.offsetTop + 420;
    }
  })()`);
  await sleep(2500);

  const ss2EqPath = path.join(ARTIFACT_DIR, 'screen_whiteboard_p2_equations.png');
  await viewerCdp.screenshot(ss2EqPath);
  console.log(`Successfully captured Page 2 Equations: ${ss2EqPath}`);

  // -------------------------------------------------------------
  // SYSTEMATIC PAGE-BY-PAGE AUDIT & PREVIEW (PAGES 1 to 5)
  // -------------------------------------------------------------
  console.log('\n========================================');
  console.log('STARTING SYSTEMATIC PAGE-BY-PAGE AUDIT');
  console.log('========================================\n');

  const auditResults = [];

  for (let pno = 1; pno <= 5; pno++) {
    console.log(`\n--- Auditing Page ${pno} ---`);
    // Scroll left pane to page pno
    await viewerCdp.evaluate(`((p) => {
      const target = document.querySelector(\`.lt-pane-left .lt-page-wrap[data-page-number="\${p}"]\`);
      if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
    })(${pno})`);

    // Wait for page pno to render & translate
    for (let waitIdx = 0; waitIdx < 20; waitIdx++) {
      const isReady = await viewerCdp.evaluate(`((p) => {
        const pageEl = document.querySelector(\`.lt-whiteboard-page[data-page-number="\${p}"]\`);
        if (!pageEl) return false;
        const blocks = pageEl.querySelectorAll('.lt-sentence, .lt-trans-block, [data-sentence-id]').length;
        const hasDoneBadge = pageEl.querySelector('.lt-status-done') !== null;
        return blocks > 5 || hasDoneBadge;
      })(${pno})`);
      if (isReady) break;
      await sleep(1500);
    }
    await sleep(2500);

    // Audit DOM structure of Page pno
    const pageAudit = await viewerCdp.evaluate(`((p) => {
      const pageEl = document.querySelector(\`.lt-whiteboard-page[data-page-number="\${p}"]\`);
      if (!pageEl) return { page: p, found: false };

      const titleEl = pageEl.querySelector('.lt-wb-title');
      const authorsEl = pageEl.querySelector('.lt-wb-authors');
      const abstractEl = pageEl.querySelector('.lt-wb-abstract-box');
      const col1Els = Array.from(pageEl.querySelectorAll('.lt-wb-col-left .lt-wb-component, .lt-wb-col-1 .lt-wb-component, .lt-wb-paragraph'));
      const col2Els = Array.from(pageEl.querySelectorAll('.lt-wb-col-right .lt-wb-component, .lt-wb-col-2 .lt-wb-component'));
      const equations = Array.from(pageEl.querySelectorAll('.lt-wb-equation')).length;
      const algorithms = Array.from(pageEl.querySelectorAll('.lt-wb-algorithm-box')).length;

      const titleText = titleEl ? titleEl.innerText.trim() : '';
      const authorsText = authorsEl ? authorsEl.innerText.trim() : '';
      const abstractText = abstractEl ? abstractEl.innerText.trim() : '';
      const col1Texts = col1Els.map(el => el.innerText.trim());
      const col2Texts = col2Els.map(el => el.innerText.trim());

      // Check for duplicate text between sections
      const duplicates = [];
      if (authorsText) {
        // If authorsText has full paragraph sentences from col1
        col1Texts.forEach((cText, idx) => {
          if (cText.length > 30 && authorsText.includes(cText.slice(0, 40))) {
            duplicates.push({ sectionA: 'authors', sectionB: \`col1_item_\${idx}\`, snippet: cText.slice(0, 60) });
          }
        });
      }

      // Check for misclassification: paragraph text inside authors
      const isParagraphInAuthors = authorsText.length > 250 ||
        /^(các mô hình|chúng tôi|in this work|diffusion models|tóm tắt)/i.test(authorsText);

      return {
        page: p,
        found: true,
        title: titleText.slice(0, 80),
        authors: authorsText.slice(0, 150),
        authorsLength: authorsText.length,
        abstract: abstractText.slice(0, 80),
        col1Count: col1Els.length,
        col2Count: col2Els.length,
        equations,
        algorithms,
        duplicates,
        isParagraphInAuthors,
      };
    })(${pno})`);

    auditResults.push(pageAudit);
    console.log(`Page ${pno} Audit Summary:`, JSON.stringify(pageAudit, null, 2));

    // Capture full preview of page pno
    const pPath = path.join(ARTIFACT_DIR, `preview_page_${pno}.png`);
    await viewerCdp.screenshot(pPath);
    console.log(`Saved screenshot: ${pPath}`);
  }

  console.log('\n========================================');
  console.log('AUDIT COMPLETED. OVERALL FINDINGS:');
  console.log(JSON.stringify(auditResults, null, 2));
  console.log('========================================\n');

  viewerCdp.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
