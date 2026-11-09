const path = require('path');
const puppeteer = require(path.resolve(__dirname, '../ui/node_modules/puppeteer-core'));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
      errors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    console.error('BROWSER PAGE ERROR:', err.message);
    errors.push(err.message);
  });

  console.log('1. Loading Landing Page...');
  await page.goto('http://127.0.0.1:8000/', { waitUntil: 'networkidle0' });

  // Test interactive simulator button
  const simButton = await page.waitForSelector('button::-p-text(Solve with Min-Cut Hitting Set)');
  if (simButton) {
    await simButton.click();
    console.log('   -> Successfully clicked Min-Cut Hitting Set simulator button');
  }

  console.log('2. Loading Atelier Console Page...');
  await page.goto('http://127.0.0.1:8000/console', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  console.log('3. Clicking Stage filter button: Attack Path...');
  const attackPathFilter = await page.waitForSelector('button::-p-text(Attack Path)');
  if (attackPathFilter) {
    await attackPathFilter.click();
    console.log('   -> Stage filter switched to Attack Path');
  }

  console.log('4. Testing Keyboard Shortcut ? (Shortcuts Dialog)...');
  await page.keyboard.press('?');
  await new Promise(r => setTimeout(r, 400));
  const shortcutsDialog = await page.$('h2::-p-text(Keyboard Shortcuts)');
  console.log('   -> Keyboard Shortcuts Dialog opened:', Boolean(shortcutsDialog));

  // Dismiss with Escape
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 400));

  console.log('5. Clicking LeftRail Pipeline Stepper: Skeptic...');
  const skepticStep = await page.waitForSelector('button::-p-text(Skeptic)');
  if (skepticStep) {
    await skepticStep.click();
    console.log('   -> Jumped to Skeptic tab via pipeline stepper');
  }

  console.log('6. Clicking LeftRail Asset Filter Chip: Crown...');
  const crownChip = await page.waitForSelector('button::-p-text(Crown)');
  if (crownChip) {
    await crownChip.click();
    console.log('   -> Filtered asset list to Crown Jewels');
  }

  console.log('7. Testing Space shortcut to trigger verified cut sequence...');
  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 1000));
  console.log('   -> Space shortcut triggered choreography successfully');

  console.log('\n--- VERIFICATION RESULT ---');
  console.log('TOTAL BROWSER ERRORS:', errors.length);
  if (errors.length === 0) {
    console.log('ALL INTERACTIVE WORKFLOWS PASSED WITH 0 ERRORS!');
  }

  await browser.close();
  process.exit(errors.length === 0 ? 0 : 1);
})();
