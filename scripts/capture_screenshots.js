const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACT_DIR = "C:\\Users\\PRANVE K\\.gemini\\antigravity\\brain\\4800a7cb-46a3-4526-9949-86292fbf38cc";

const BREAKPOINTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "1024", width: 1024, height: 768 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
];

async function capture() {
  console.log("Launching Chrome at:", CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();

  // 1. Capture Landing across breakpoints
  for (const bp of BREAKPOINTS) {
    await page.setViewport({ width: bp.width, height: bp.height });
    await page.goto("http://127.0.0.1:8000/", { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1000));
    const dest = path.join(ARTIFACT_DIR, `screenshot_landing_${bp.name}px.png`);
    await page.screenshot({ path: dest, fullPage: false });
    console.log(`Captured Landing at ${bp.name}px -> ${dest}`);
  }

  // 2. Capture Console across breakpoints
  for (const bp of BREAKPOINTS) {
    await page.setViewport({ width: bp.width, height: bp.height });
    await page.goto("http://127.0.0.1:8000/console", { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1500));
    const dest = path.join(ARTIFACT_DIR, `screenshot_console_${bp.name}px.png`);
    await page.screenshot({ path: dest, fullPage: false });
    console.log(`Captured Console at ${bp.name}px -> ${dest}`);
  }

  // 3. Capture Console with Verified Plan shown
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://127.0.0.1:8000/console", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1000));

  // Click Show verified plan
  try {
    const buttons = await page.$$("button");
    for (const btn of buttons) {
      const text = await page.evaluate((el) => el.innerText, btn);
      if (text && text.includes("SHOW VERIFIED PLAN")) {
        await btn.click();
        console.log("Clicked SHOW VERIFIED PLAN");
        break;
      }
    }
    // Wait for the cut and verified transition
    await new Promise((r) => setTimeout(r, 6500));
    const destCut = path.join(ARTIFACT_DIR, "screenshot_console_verified_cut_1440px.png");
    await page.screenshot({ path: destCut, fullPage: false });
    console.log(`Captured Console Verified Cut -> ${destCut}`);
  } catch (err) {
    console.error("Error triggering verified cut:", err);
  }

  // 4. Capture Report Page
  await page.goto("http://127.0.0.1:8000/console/report", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1000));
  const destReport = path.join(ARTIFACT_DIR, "screenshot_report_1440px.png");
  await page.screenshot({ path: destReport, fullPage: false });
  console.log(`Captured Report Page -> ${destReport}`);

  // 5. Capture Limitations Modal
  await page.goto("http://127.0.0.1:8000/console", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1000));
  const boundaryBtn = await page.$("button[title*='boundaries']");
  if (boundaryBtn) {
    await boundaryBtn.click();
    await new Promise((r) => setTimeout(r, 500));
    const destModal = path.join(ARTIFACT_DIR, "screenshot_boundaries_modal_1440px.png");
    await page.screenshot({ path: destModal, fullPage: false });
    console.log(`Captured Boundaries Modal -> ${destModal}`);
  }

  await browser.close();
  console.log("Screenshot capture complete!");
}

capture().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
