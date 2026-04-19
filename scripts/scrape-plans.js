const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function scrapePlans() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  console.log('Navigating to devices page...');
  await page.goto('https://shop.freedommobile.ca/en-CA/devices', {
    waitUntil: 'networkidle',
    timeout: 60000
  });

  // Hard wait 5 seconds for JS rendering
  await page.waitForTimeout(5000);

  // Take a screenshot so we can see what Playwright actually loaded
  // This saves to the Actions artifacts for debugging
  await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
  console.log('Screenshot saved as debug-screenshot.png');

  // Log the full page HTML so we can inspect what DOM exists
  const html = await page.content();
  console.log('PAGE HTML SAMPLE (first 3000 chars):');
  console.log(html.substring(0, 3000));

  // Log ALL text visible on page to find device names
  const allText = await page.evaluate(() => document.body.innerText);
  console.log('ALL VISIBLE TEXT ON PAGE:');
  console.log(allText.substring(0, 5000));

  await browser.close();

  // DO NOT write to Supabase yet - just log and exit
  // We need to see the debug output first
  console.log('Debug run complete - check logs above');
  process.exit(0);
}

scrapePlans().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
