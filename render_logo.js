const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const svg = fs.readFileSync('client/public/logo.svg', 'utf8');
  await page.setContent(`<!DOCTYPE html><html><body style='margin: 0; padding: 0; display: inline-block; background: transparent;'>${svg}</body></html>`);
  const svgElement = await page.$('svg');
  await svgElement.screenshot({ path: 'mobile/assets/logo.png', omitBackground: true });
  await browser.close();
  console.log('Logo generated successfully!');
})();
