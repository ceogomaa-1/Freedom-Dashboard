// @ts-check
'use strict';

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const DEVICES_URL = 'https://shop.freedommobile.ca/en-CA/devices';
const CACHE_KEY   = 'global';

const BRANDS = new Set(['Apple', 'Samsung', 'Google', 'Motorola', 'TCL', 'OnePlus', 'Nokia', 'Xiaomi', 'Alcatel']);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Parse device list from the full page text.
 *
 * Each device block in the page text looks exactly like:
 *
 *   Apple            ← brand (standalone line)
 *   iPhone 17        ← device name
 *   $32/mo.          ← monthly price
 *   with TradeUp     ← "with TradeUp" or "with MyTab"
 *   From $0,Save up to $361
 *   with $40/mo. plan. 2-year term required.
 *
 * Some devices are preceded by a "Like-New CPO" badge line.
 *
 * @param {string} text
 */
function parseDevicesFromText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const devices = [];
  const seen    = new Set();

  for (let i = 0; i < lines.length - 5; i++) {
    if (!BRANDS.has(lines[i])) continue;

    const brand = lines[i];
    const name  = lines[i + 1] || '';

    // Validate device name
    if (!name || name.length < 3 || BRANDS.has(name) || /^\$/.test(name) || /^\d+$/.test(name)) continue;

    // Was the line just before the brand a "Like-New CPO" badge?
    const isCPO = i > 0 && /Like-New CPO/i.test(lines[i - 1]);

    const priceLine = lines[i + 2] || '';
    const labelLine = lines[i + 3] || '';
    const saveLine  = lines[i + 4] || '';
    const planLine  = lines[i + 5] || '';

    // Must match the pricing block pattern
    if (!/^\$[\d.]+/.test(priceLine))              continue;
    if (!/with (TradeUp|MyTab)/i.test(labelLine))  continue;

    const priceMatch = priceLine.match(/\$([\d.]+)/);
    const saveMatch  = saveLine.match(/Save up to \$(\d+)/i);
    const planMatch  = planLine.match(/with (\$[\d.]+\/mo\.?\s*plan)/i);
    const termMatch  = planLine.match(/(\d+)[\s-]year term/i);

    const pricing = {
      monthlyPrice: priceMatch ? parseFloat(priceMatch[1]) : 0,
      fromPrice:    0,
      saveUpTo:     saveMatch ? parseInt(saveMatch[1]) : 0,
      requiredPlan: planMatch ? planMatch[1] : '',
      termMonths:   termMatch ? parseInt(termMatch[1]) * 12 : 24,
    };

    const isTradeUp = /TradeUp/i.test(labelLine);
    const is5G      = /5G/i.test(name);

    // Deduplicate: treat CPO variants as separate entries
    const key = `${brand}|${name}|${isCPO}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    devices.push({
      brand,
      name: isCPO ? `${name} (Like-New)` : name,
      is5G,
      tradeUp: isTradeUp ? pricing : null,
      myTab:   isTradeUp ? null : pricing,
    });
  }

  return devices;
}

async function scrapeDevices() {
  console.log(`Navigating to ${DEVICES_URL}`);

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-CA',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  await page.goto(DEVICES_URL, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(5000);

  const pageText = await page.evaluate(() => document.body.innerText);
  await browser.close();

  console.log(`Page text captured (${pageText.length} chars)`);

  const devices = parseDevicesFromText(pageText);

  if (devices.length === 0) {
    throw new Error('No devices extracted. Inspect page text manually.');
  }

  // Stamp IDs
  const stamped = devices.map((d, idx) => ({
    id: `${Date.now()}-${idx}`,
    ...d,
  }));

  console.log(`\nExtracted ${stamped.length} devices:`);
  for (const d of stamped) {
    const tu = d.tradeUp ? `TradeUp $${d.tradeUp.monthlyPrice}/mo` : '';
    const mt = d.myTab   ? `MyTab $${d.myTab.monthlyPrice}/mo`     : '';
    console.log(`  ${d.brand} ${d.name}${d.is5G ? ' [5G+]' : ''} — ${[tu, mt].filter(Boolean).join(' | ')}`);
  }

  const { error } = await supabase
    .from('plan_cache')
    .upsert(
      { cache_key: CACHE_KEY, plans: stamped, fetched_at: new Date().toISOString() },
      { onConflict: 'cache_key' }
    );

  if (error) throw new Error(`Supabase write failed: ${error.message}`);

  console.log('\nDevices saved to Supabase successfully');
}

scrapeDevices().catch(err => {
  console.error('Scrape failed:', err.message);
  process.exit(1);
});
