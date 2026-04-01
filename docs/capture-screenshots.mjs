import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, 'screenshots');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const screenshotNames = [
  '01_main_standby',
  '02_active_detection',
  '03_ble_remote_id',
  '04_detection_history',
  '05_settings',
  '06_onboarding',
];

const configs = [
  {
    htmlFile: 'screenshots.html',
    selector: '.phone',
    prefix: '',
    width: 428,
    height: 926,
    dpr: 3, // 428*3=1284, 926*3=2778
  },
  {
    htmlFile: 'screenshots-ipad.html',
    selector: '.tablet',
    prefix: 'ipad_',
    width: 1024,
    height: 1366,
    dpr: 2, // 1024*2=2048, 1366*2=2732
  },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const config of configs) {
    const page = await browser.newPage();
    await page.setViewport({
      width: config.width,
      height: config.height,
      deviceScaleFactor: config.dpr,
    });

    const htmlPath = path.join(__dirname, config.htmlFile);
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

    const elements = await page.$$(config.selector);
    console.log(`[${config.htmlFile}] Found ${elements.length} frames`);

    for (let i = 0; i < elements.length; i++) {
      const name = screenshotNames[i] || `screenshot_${i + 1}`;
      const outPath = path.join(outputDir, `${config.prefix}${name}.png`);

      await elements[i].screenshot({ path: outPath, type: 'png' });
      console.log(`  Saved ${config.prefix}${name}.png`);
    }

    await page.close();
  }

  await browser.close();

  // Verify dimensions
  const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.png'));
  console.log(`\nAll ${files.length} screenshots saved to: ${outputDir}`);
  for (const f of files) {
    const buf = fs.readFileSync(path.join(outputDir, f));
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    console.log(`  ${f}: ${w}x${h}px`);
  }
})();
