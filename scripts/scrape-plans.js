// @ts-check
'use strict';

/**
 * Freedom Mobile device scraper — runs inside GitHub Actions via Playwright.
 * Writes structured device data to the Supabase `plan_cache` table.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const DEVICES_URL = 'https://shop.freedommobile.ca/en-CA/devices';
const CACHE_KEY = 'global';
const KNOWN_BRANDS = ['Apple', 'Samsung', 'Google', 'Motorola', 'OnePlus', 'Nokia', 'TCL', 'Xiaomi', 'Alcatel', 'HTC', 'Sony', 'LG'];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * @param {string} text
 * @returns {{ monthlyPrice: number, fromPrice: number, saveUpTo: number, requiredPlan: string, termMonths: number } | null}
 */
function parsePricing(text) {
  const priceMatch = text.match(/\$(\d+(?:\.\d+)?)\s*\/\s*mo/i);
  if (!priceMatch) return null;

  const fromMatch = text.match(/[Ff]rom\s*\$(\d+(?:\.\d+)?)/);
  const saveMatch = text.match(/[Ss]ave up to\s*\$(\d+)/i);
  const planMatch = text.match(/with\s*(\$[\d.]+\s*\/\s*mo\.?\s*plan)/i);
  const yearTermMatch = text.match(/(\d+)[\s-]year\s*term/i);
  const monthTermMatch = text.match(/(\d+)[\s-]month\s*term/i);

  let termMonths = 24;
  if (yearTermMatch) termMonths = parseInt(yearTermMatch[1]) * 12;
  else if (monthTermMatch) termMonths = parseInt(monthTermMatch[1]);

  return {
    monthlyPrice: parseFloat(priceMatch[1]),
    fromPrice: fromMatch ? parseFloat(fromMatch[1]) : 0,
    saveUpTo: saveMatch ? parseInt(saveMatch[1]) : 0,
    requiredPlan: planMatch ? planMatch[1].trim() : '',
    termMonths,
  };
}

/**
 * Parse device list from the full page text using brand-name anchoring.
 * Reliable even when DOM class names are obfuscated.
 * @param {string} text
 */
function parseDevicesFromPageText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const devices = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Anchor on a standalone known brand line
    if (!KNOWN_BRANDS.includes(line)) continue;

    const brand = line;
    const nextLine = (lines[i + 1] || '').replace(/5G\+?/gi, '').trim();

    // Device name must be non-empty, not another brand, not a price, not a number
    if (
      !nextLine ||
      nextLine.length < 3 ||
      /^\d[\d\s$./]*$/.test(nextLine) ||    // pure number / price
      KNOWN_BRANDS.includes(nextLine)
    ) continue;

    const name = nextLine;
    const key = `${brand}|${name}`.toLowerCase();
    if (seen.has(key)) continue;

    // Look ahead up to 40 lines for pricing info
    const end = Math.min(lines.length, i + 45);
    const lookahead = lines.slice(i, end).join('\n');

    const is5G = /5G\+?/.test(lookahead);

    const tradeUpIdx = lookahead.search(/with\s*TradeUp/i);
    const myTabIdx   = lookahead.search(/with\s*MyTab/i);

    let tradeUp = null;
    let myTab   = null;

    if (tradeUpIdx !== -1) {
      const seg = lookahead.slice(Math.max(0, tradeUpIdx - 40), tradeUpIdx + 350);
      tradeUp = parsePricing(seg);
    }
    if (myTabIdx !== -1) {
      const seg = lookahead.slice(Math.max(0, myTabIdx - 40), myTabIdx + 350);
      myTab = parsePricing(seg);
    }

    // Only keep if we extracted at least one pricing option
    if (!tradeUp && !myTab) continue;

    seen.add(key);
    devices.push({ brand, name, is5G, tradeUp, myTab });

    // Skip past this device's block so we don't re-process its inner lines
    i += 20;
  }

  return devices;
}

/**
 * Try to extract device data from intercepted API network responses.
 * Freedom Mobile's React app fetches product data via JSON endpoints.
 * @param {import('playwright').Page} page
 * @returns {Promise<object[]>}
 */
async function tryNetworkIntercept(page) {
  const captured = [];

  page.on('response', async (response) => {
    const ct = response.headers()['content-type'] || '';
    if (!ct.includes('json')) return;
    if (response.status() !== 200) return;

    const url = response.url();
    // Look for endpoints that might contain device/product catalogs
    if (!/device|product|catalog|handset|phone|item/i.test(url)) return;

    try {
      const json = await response.json();
      const arr = Array.isArray(json) ? json : (json?.data ?? json?.items ?? json?.products ?? json?.devices);
      if (!Array.isArray(arr) || arr.length < 3) return;

      const sample = arr[0];
      // Must look like a device object
      if (
        sample &&
        typeof sample === 'object' &&
        (sample.name || sample.title || sample.model || sample.device_name || sample.displayName)
      ) {
        console.log(`📡 Intercepted device API: ${url} (${arr.length} items)`);
        captured.push(...arr);
      }
    } catch { /* not parseable JSON */ }
  });

  return captured;
}

async function scrapeDevices() {
  console.log(`🔍 Navigating to ${DEVICES_URL}`);

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-CA',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Attach network listener before navigation
  const networkItems = await tryNetworkIntercept(page);

  await page.goto(DEVICES_URL, { waitUntil: 'networkidle', timeout: 45_000 });

  // Extra wait for JS hydration to fully settle
  await page.waitForTimeout(3000);

  console.log(`📄 Page loaded. Network captured ${networkItems.length} raw device items.`);

  // ── Strategy A: page text parsing (most reliable for obfuscated React apps) ──
  const pageText = await page.evaluate(() => document.body.innerText);
  console.log(`📝 Page text length: ${pageText.length} chars`);

  let devices = parseDevicesFromPageText(pageText);
  console.log(`🔎 Text parsing found ${devices.length} devices`);

  // ── Strategy B: network-intercepted JSON ─────────────────────────────────────
  if (devices.length < 3 && networkItems.length >= 3) {
    console.log('⚡ Falling back to network-intercepted device data...');
    const seen = new Set();
    devices = networkItems
      .filter(item => {
        const name = String(item.name ?? item.title ?? item.model ?? item.displayName ?? '');
        return name.length > 2 && !seen.has(name) && seen.add(name);
      })
      .map(item => {
        const name = String(item.name ?? item.title ?? item.model ?? item.displayName ?? '');
        const brand = String(item.brand ?? item.manufacturer ?? '');
        return {
          brand,
          name,
          is5G: /5G/.test(name) || /5G/.test(JSON.stringify(item)),
          tradeUp: null,
          myTab: null,
        };
      });
  }

  await browser.close();

  if (devices.length === 0) {
    throw new Error(
      'No devices extracted — inspect https://shop.freedommobile.ca/en-CA/devices manually.'
    );
  }

  // Stamp unique IDs
  const stamped = devices.map((d, idx) => ({
    id: `${Date.now()}-${idx}`,
    brand: d.brand,
    name: d.name,
    is5G: d.is5G,
    tradeUp: d.tradeUp,
    myTab: d.myTab,
  }));

  console.log(`\n📋 Extracted ${stamped.length} unique devices:`);
  for (const d of stamped) {
    const tu = d.tradeUp ? `TradeUp $${d.tradeUp.monthlyPrice}/mo` : '';
    const mt = d.myTab   ? `MyTab $${d.myTab.monthlyPrice}/mo`   : '';
    console.log(`  ${d.brand} ${d.name}${d.is5G ? ' [5G+]' : ''} — ${[tu, mt].filter(Boolean).join(' | ') || '(no pricing)'}`);
  }

  // Write to Supabase
  const { error } = await supabase
    .from('plan_cache')
    .upsert(
      { cache_key: CACHE_KEY, plans: stamped, fetched_at: new Date().toISOString() },
      { onConflict: 'cache_key' }
    );

  if (error) throw new Error(`Supabase write failed: ${error.message}`);

  console.log('\n✅ Devices saved to Supabase successfully');
}

scrapeDevices().catch(err => {
  console.error('\n❌ Scrape failed:', err.message);
  process.exit(1);
});
