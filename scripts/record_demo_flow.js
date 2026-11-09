const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACT_DIR = "C:\\Users\\PRANVE K\\.gemini\\antigravity\\brain\\4800a7cb-46a3-4526-9949-86292fbf38cc";
const FRAMES_DIR = path.join(ARTIFACT_DIR, "demo_frames");

async function recordDemo() {
  console.log("Starting browser recording of full 2-minute demo flow...");
  if (!fs.existsSync(FRAMES_DIR)) {
    fs.mkdirSync(FRAMES_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--window-size=1440,900"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  let frameCount = 0;
  async function snap(label) {
    frameCount++;
    const pad = String(frameCount).padStart(3, "0");
    const framePath = path.join(FRAMES_DIR, `frame_${pad}_${label}.png`);
    await page.screenshot({ path: framePath, fullPage: false });
    console.log(`[Frame ${pad}] ${label}`);
  }

  // 1. Landing Page Hero
  await page.goto("http://127.0.0.1:8000/", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1000));
  await snap("landing_hero");

  // Scroll to distinction table
  await page.evaluate(() => window.scrollBy({ top: 700, behavior: "smooth" }));
  await new Promise((r) => setTimeout(r, 1000));
  await snap("landing_distinction");

  // Scroll to min-cut schematic
  await page.evaluate(() => window.scrollBy({ top: 800, behavior: "smooth" }));
  await new Promise((r) => setTimeout(r, 1000));
  await snap("landing_mincut_schematic");

  // 2. Open Console
  await page.goto("http://127.0.0.1:8000/console", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1500));
  await snap("console_initial");

  // 3. Inspect Asset app01
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const appBtn = buttons.find((b) => b.innerText.includes("app01"));
    if (appBtn) appBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));
  await snap("console_asset_selected");

  // 4. Open Skeptic Tab
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const skepticBtn = buttons.find((b) => b.innerText.includes("Skeptic"));
    if (skepticBtn) skepticBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));
  await snap("console_skeptic_tab");

  // Expand first finding
  await page.evaluate(() => {
    const verdictHeaders = Array.from(document.querySelectorAll(".cursor-pointer"));
    if (verdictHeaders.length > 0) verdictHeaders[0].click();
  });
  await new Promise((r) => setTimeout(r, 800));
  await snap("console_skeptic_evidence_expanded");

  // 5. Open Plan Tab
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const planBtn = buttons.find((b) => b.innerText.includes("Plan & Verify"));
    if (planBtn) planBtn.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  await snap("console_plan_before_cut");

  // 6. Click "SHOW VERIFIED PLAN"
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const showBtn = buttons.find((b) => b.innerText.includes("SHOW VERIFIED PLAN"));
    if (showBtn) showBtn.click();
  });

  // Capture cut sequence progression
  await new Promise((r) => setTimeout(r, 1500));
  await snap("console_cut_anim_pulse");

  await new Promise((r) => setTimeout(r, 2000));
  await snap("console_cut_anim_slashing");

  await new Promise((r) => setTimeout(r, 3200));
  await snap("console_cut_anim_verified_steady");

  // 7. Open Boundaries Modal
  await page.evaluate(() => {
    const boundaryBtn = document.querySelector("button[title*='boundaries']");
    if (boundaryBtn) boundaryBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));
  await snap("console_boundaries_modal");

  // Close modal
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 600));

  // 8. Open Report Page
  await page.goto("http://127.0.0.1:8000/console/report", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1200));
  await snap("report_document_view");

  await browser.close();
  console.log(`Demo recording complete! Captured ${frameCount} sequence frames.`);
}

recordDemo().catch((err) => {
  console.error("Recording failed:", err);
  process.exit(1);
});
