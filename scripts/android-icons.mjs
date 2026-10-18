import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const workspace = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const svg = await readFile(path.join(workspace, "public/morrow.svg"));
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  for (const size of [192, 512]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<html><head><style>html,body{margin:0;width:100%;height:100%;background:transparent}img{display:block;width:100%;height:100%}</style></head><body><img alt="Morrow" src="data:image/svg+xml;base64,${svg.toString("base64")}"></body></html>`,
    );
    await page.locator("img").evaluate((image) => image.decode());
    const output = path.join(workspace, `public/icon-${size}.png`);
    await page.screenshot({ path: output, omitBackground: true });
    await page.close();
    console.log(
      `Generated icon-${size}.png (${(await stat(output)).size} bytes).`,
    );
  }
} finally {
  await browser.close();
}
