import { mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.PITCH_BASE_URL ?? 'http://127.0.0.1:5178';
const outputDir = resolve('outputs/pitch-assets');

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function captureScreenshot(name, path, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: join(outputDir, `${name}.png`), fullPage: true });
  await page.close();
}

await captureScreenshot('01-landing-mobile', '/', { width: 390, height: 844 });
await captureScreenshot('02-landing-desktop', '/', { width: 1440, height: 1000 });
await captureScreenshot('03-onboarding-start-mobile', '/start', { width: 390, height: 844 });
await captureScreenshot('04-login-mobile', '/login', { width: 390, height: 844 });

const videoDir = join(outputDir, 'video-work');
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  recordVideo: { dir: videoDir, size: { width: 390, height: 844 } },
});
const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.getByRole('button', { name: 'How it works' }).click();
await page.waitForTimeout(1300);
await page.getByRole('button', { name: 'Get Started' }).first().click();
await page.waitForTimeout(1200);
await context.close();

const video = page.video();
if (video) {
  await video.saveAs(join(outputDir, '05-demo-flow.webm'));
}
await rm(videoDir, { recursive: true, force: true });
await browser.close();

console.log(`Pitch assets saved to ${outputDir}`);
