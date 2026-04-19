// @ts-check
'use strict';

/**
 * Freedom Mobile plan scraper — runs inside GitHub Actions via Playwright.
 * Writes structured plan data to the Supabase `plan_cache` table.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const PLANS_URL = 'https://shop.freedommobile.ca/en-CA/plans';
const CACHE_KEY = 'global';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function scrapePlans() {
  console.log(`🔍 Navigating to ${PLANS_URL}`);

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    locale: 'en-CA',
  });
  const page = await context.newPage();

  await page.goto(PLANS_URL, { waitUntil: 'networkidle', timeout: 30_000 });

  // Wait for plan cards — try selectors in priority order
  const candidateSelectors = [
    '[class*="PlanCard"]',
    '[class*="plan-card"]',
    '[class*="planCard"]',
    '[class*="PlanTile"]',
    '[class*="plan-tile"]',
    '[data-testid*="plan"]',
    '[data-cy*="plan"]',
    'article',
  ];

  let matchedSelector = null;
  for (const sel of candidateSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 8_000 });
      const count = await page.locator(sel).count();
      if (count > 0) {
        matchedSelector = sel;
        console.log(`✅ Found ${count} elements with selector: ${sel}`);
        break;
      }
    } catch {
      // try next
    }
  }

  if (!matchedSelector) {
    console.log('⚠️  No plan card selector matched — attempting full-page extraction');
  }

  // Extract plan data from the rendered DOM
  const rawPlans = await page.evaluate((sel) => {
    /** @type {Element[]} */
    let cards = [];

    if (sel) {
      cards = Array.from(document.querySelectorAll(sel));
    }

    // Fallback: any element containing a price pattern that looks like a plan
    if (cards.length === 0) {
      const all = Array.from(document.querySelectorAll('div, section, article, li'));
      cards = all.filter(el => {
        const t = el.innerText || '';
        return /\$\d{2,3}/.test(t) && /\d+\s*GB|unlimited/i.test(t);
      });
    }

    return cards.map(card => {
      const text = (card.innerText || '').trim();

      // Price: look for $XX or $XX/mo patterns
      const priceMatch = text.match(/\$\s*(\d{2,3})(?:\.?\d{0,2})?\s*(?:\/\s*mo(?:nth)?)?/i);
      const price = priceMatch ? `$${priceMatch[1]}/mo` : '';

      // Data
      const dataMatch = text.match(/(\d+)\s*GB/i);
      const isUnlimited = /unlimited/i.test(text);
      const data = dataMatch
        ? `${dataMatch[1]} GB`
        : isUnlimited
        ? 'Unlimited'
        : '';

      // Network coverage
      const networkMatch = text.match(
        /Canada[\s,\-–&]+(?:US|United States)[\s,\-–&]+Mexico|Canada[\s,\-–]+US|Nationwide|Canada[\s-]+Wide|Canada only/i
      );
      const network = networkMatch ? networkMatch[0].trim() : '';

      // Plan name — heading elements inside the card, or first non-empty line
      const nameEl = card.querySelector('h1, h2, h3, h4, h5, [class*="title"], [class*="name"], [class*="heading"]');
      const name = (nameEl && nameEl.innerText.trim())
        || text.split('\n').map(l => l.trim()).filter(l => l && !/^\$/.test(l))[0]
        || '';

      // Promo
      const promoMatch = text.match(
        /bonus\s+\d+\s*GB|limited[\s\-]+time|promo(?:tion)?|save\s+\$\d+|extra\s+\d+\s*GB/i
      );
      const promoText = promoMatch ? promoMatch[0].trim() : '';

      return { name, price, data, network, promoText, rawText: text.slice(0, 200) };
    }).filter(p => p.price !== '');  // discard elements with no price
  }, matchedSelector);

  await browser.close();

  // De-duplicate by price+data key and add stable id
  /** @type {Map<string, object>} */
  const seen = new Map();
  const plans = [];
  for (const p of rawPlans) {
    const key = `${p.price}|${p.data}`;
    if (!seen.has(key)) {
      seen.set(key, true);
      plans.push({
        id: `${Date.now()}-${plans.length}`,
        name: p.name,
        price: p.price,
        data: p.data,
        network: p.network,
        promoText: p.promoText,
        is_promo: Boolean(p.promoText),
      });
    }
  }

  console.log(`\n📋 Extracted ${plans.length} unique plans:`);
  plans.forEach(p => console.log(`  ${p.name} — ${p.price} — ${p.data}`));

  if (plans.length === 0) {
    throw new Error(
      'No plans extracted. DOM selectors may need updating — ' +
      'inspect https://shop.freedommobile.ca/en-CA/plans manually.'
    );
  }

  // Write to Supabase
  const { error } = await supabase
    .from('plan_cache')
    .upsert(
      { cache_key: CACHE_KEY, plans, fetched_at: new Date().toISOString() },
      { onConflict: 'cache_key' }
    );

  if (error) throw new Error(`Supabase write failed: ${error.message}`);

  console.log('\n✅ Plans saved to Supabase successfully');
}

scrapePlans().catch(err => {
  console.error('\n❌ Scrape failed:', err.message);
  process.exit(1);
});
