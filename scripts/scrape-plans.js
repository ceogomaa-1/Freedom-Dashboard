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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Parse a pricing text block into structured fields.
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

  await page.goto(DEVICES_URL, { waitUntil: 'networkidle', timeout: 45_000 });

  // Extra wait for JS rendering to settle
  await page.waitForTimeout(3000);

  console.log('⏳ Page loaded — extracting device data...');

  // Extract all device cards from the DOM
  const rawDevices = await page.evaluate(() => {
    /**
     * Parse pricing info from a text segment.
     * @param {string} text
     */
    function parsePricingInBrowser(text) {
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

    // ── Strategy 1: try known card class name fragments ──────────────────────
    const cardSelectors = [
      '[class*="DeviceCard"]',
      '[class*="device-card"]',
      '[class*="DeviceTile"]',
      '[class*="device-tile"]',
      '[class*="ProductCard"]',
      '[class*="product-card"]',
      'li[class*="item"]',
      'li[class*="Item"]',
    ];

    /** @type {Element[]} */
    let cards = [];
    let matchedSel = '';
    for (const sel of cardSelectors) {
      try {
        const found = document.querySelectorAll(sel);
        if (found.length >= 3) {
          cards = Array.from(found);
          matchedSel = sel;
          break;
        }
      } catch { /* try next */ }
    }

    // ── Strategy 2: find leaf containers with price + TradeUp/MyTab text ────
    if (cards.length === 0) {
      const all = Array.from(document.querySelectorAll('li, article, div'));
      // Pick the smallest (innermost) elements that contain the relevant text
      const candidates = all.filter(el => {
        const t = /** @type {HTMLElement} */ (el).innerText || '';
        return (
          /\$\d+\s*\/\s*mo/i.test(t) &&
          /(TradeUp|MyTab)/i.test(t) &&
          /(iPhone|iPad|Samsung|Galaxy|Google|Pixel|Motorola|OnePlus)/i.test(t)
        );
      });
      // Remove ancestors — keep only the innermost matches
      cards = candidates.filter(
        (el) => !candidates.some((other) => other !== el && other.contains(el))
      );
      if (cards.length >= 2) matchedSel = '(heuristic)';
    }

    console.log(`Matched ${cards.length} cards with selector: "${matchedSel}"`);

    /** @type {Array<{brand:string,name:string,is5G:boolean,tradeUp:object|null,myTab:object|null,rawText:string}>} */
    const results = [];

    for (const card of cards) {
      const el = /** @type {HTMLElement} */ (card);
      const text = el.innerText || '';

      // ── Brand ──────────────────────────────────────────────────────────────
      const knownBrands = ['Apple', 'Samsung', 'Google', 'Motorola', 'OnePlus', 'Xiaomi', 'Nokia', 'TCL'];
      let brand = '';
      const brandEl = card.querySelector('[class*="brand" i], [class*="Brand"]');
      if (brandEl) {
        brand = /** @type {HTMLElement} */ (brandEl).innerText.trim();
      } else {
        for (const b of knownBrands) {
          if (new RegExp(`^${b}`, 'im').test(text)) { brand = b; break; }
        }
      }

      // ── Device name ────────────────────────────────────────────────────────
      let name = '';
      const nameEl = card.querySelector(
        'h2, h3, h4, [class*="name" i], [class*="title" i], [class*="model" i]'
      );
      if (nameEl) {
        name = /** @type {HTMLElement} */ (nameEl).innerText.trim().split('\n')[0];
      }
      if (!name) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const brandIdx = lines.findIndex(l => knownBrands.some(b => l === b));
        if (brandIdx >= 0 && lines[brandIdx + 1]) name = lines[brandIdx + 1];
        else name = lines[0] || '';
      }
      // Strip 5G+ if it leaked into the name
      name = name.replace(/5G\+?/g, '').trim();

      // ── 5G badge ───────────────────────────────────────────────────────────
      const is5G = /5G\+?/.test(text);

      // ── Pricing: find TradeUp and MyTab text segments ─────────────────────
      const tradeUpIdx = text.search(/with\s*TradeUp/i);
      const myTabIdx = text.search(/with\s*MyTab/i);

      let tradeUp = null;
      let myTab = null;

      if (tradeUpIdx !== -1) {
        const segStart = Math.max(0, tradeUpIdx - 30);
        const segEnd = Math.min(text.length, tradeUpIdx + 350);
        tradeUp = parsePricingInBrowser(text.slice(segStart, segEnd));
      }

      if (myTabIdx !== -1) {
        const segStart = Math.max(0, myTabIdx - 30);
        const segEnd = Math.min(text.length, myTabIdx + 350);
        myTab = parsePricingInBrowser(text.slice(segStart, segEnd));
      }

      if (name && (tradeUp || myTab)) {
        results.push({ brand, name, is5G, tradeUp, myTab, rawText: text.slice(0, 500) });
      }
    }

    return results;
  });

  await browser.close();

  // De-duplicate by brand+name
  /** @type {Map<string, boolean>} */
  const seen = new Map();
  /** @type {Array<object>} */
  const devices = [];

  for (const d of rawDevices) {
    const key = `${d.brand}|${d.name}`.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, true);
      devices.push({
        id: `${Date.now()}-${devices.length}`,
        brand: d.brand,
        name: d.name,
        is5G: d.is5G,
        tradeUp: d.tradeUp,
        myTab: d.myTab,
      });
    }
  }

  console.log(`\n📋 Extracted ${devices.length} unique devices:`);
  for (const d of devices) {
    const tu = d.tradeUp ? `TradeUp $${d.tradeUp.monthlyPrice}/mo` : '';
    const mt = d.myTab ? `MyTab $${d.myTab.monthlyPrice}/mo` : '';
    console.log(`  ${d.brand} ${d.name}${d.is5G ? ' [5G+]' : ''} — ${[tu, mt].filter(Boolean).join(' | ')}`);
  }

  if (devices.length === 0) {
    throw new Error(
      'No devices extracted. DOM selectors may need updating — ' +
      'inspect https://shop.freedommobile.ca/en-CA/devices manually.'
    );
  }

  // Write to Supabase
  const { error } = await supabase
    .from('plan_cache')
    .upsert(
      { cache_key: CACHE_KEY, plans: devices, fetched_at: new Date().toISOString() },
      { onConflict: 'cache_key' }
    );

  if (error) throw new Error(`Supabase write failed: ${error.message}`);

  console.log('\n✅ Devices saved to Supabase successfully');
}

scrapeDevices().catch(err => {
  console.error('\n❌ Scrape failed:', err.message);
  process.exit(1);
});
