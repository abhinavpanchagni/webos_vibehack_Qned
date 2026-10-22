/* Local-only browser regression checks. Never connects to the TV.
 * Setup: npm install --prefix build/qa --no-audit --no-fund playwright-core
 * Run: node scripts/verify-ui.cjs
 * Override CHROME_PATH if Chrome is installed elsewhere.
 */
const { chromium } = require('../build/qa/node_modules/playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '../app');
const output = path.resolve(__dirname, '../docs/redesign');
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.ttf':'font/ttf' };
const results = [];
const server = http.createServer((req,res) => {
  const target = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!target.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(target, (error,data) => { res.writeHead(error ? 404 : 200, {'Content-Type':mime[path.extname(target)] || 'application/octet-stream'}); res.end(error ? 'Not found' : data); });
});

async function main() {
 await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
 const url = 'http://127.0.0.1:' + server.address().port;
 const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
  const context = await browser.newContext({viewport:{width:1920,height:1080}});
  await context.addInitScript(() => {
   window.__launches = [];
   window.__failLaunch = false;
   window.PalmServiceBridge = function () {
    this.call = (uri,json) => {
     const params = JSON.parse(json);
     if (uri.endsWith('/launch')) {
      window.__launches.push(params);
      this.onservicecallback(JSON.stringify({returnValue:!window.__failLaunch}));
     } else this.onservicecallback(JSON.stringify({returnValue:true,wifi:{state:'connected',ssid:'Wi-Fi'}}));
    };
   };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const wait = ms => page.waitForTimeout(ms);
  const press = key => page.keyboard.press(key);
  const focusedChar = () => page.locator('.char-item.focused').getAttribute('data-id');
  const focusedApp = () => page.locator('.item.focused').getAttribute('data-app-id');
  const appsScreen = () => page.evaluate(() => document.body.classList.contains('apps-screen'));
  const record = name => { results.push(name); console.log('PASS ' + name); };
  // Keep screenshot rasterization out of timing-sensitive input regression checks.
  const capture = async name => { if (process.env.CAPTURE_SCREENSHOTS === '1') await page.screenshot({path:path.join(output,name)}); };
  const launchCount = () => page.evaluate(() => __launches.length);
  const lastLaunch = () => page.evaluate(() => __launches[__launches.length-1]);
  const resume = () => page.evaluate(() => document.dispatchEvent(new Event('webOSRelaunch')));
  fs.mkdirSync(output,{recursive:true});
  await page.goto(url); await wait(900);
  assert.equal(await appsScreen(),false);
  assert.equal(await page.locator('.char-item').count(),5);
  assert.equal(await page.locator('.char-item.focused').count(),0);
  assert.equal(await page.locator('#dashboard').getAttribute('aria-hidden'),'true');
  assert.equal(await page.locator('#wallpaper').count(),0);
  assert.deepEqual(await page.locator('img').evaluateAll(imgs => imgs.filter(i => !i.complete || !i.naturalWidth).map(i => i.src)),[]);
  const expected = await page.evaluate(() => TV_APPS.apps.filter(a => CONFIG.hiddenApps.indexOf(a.id)<0).map(a=>a.id).sort());
  assert.deepEqual(await page.locator('.item').evaluateAll(els=>els.map(e=>e.dataset.appId).sort()),expected);
  await capture('01-showcase.png');
  record('Initial black showcase; five assets loaded; dashboard hidden; complete synchronized inventory');

  for (const [i,id] of ['steve','rengoku','joe','benjamin','hannah'].entries()) {
   await press('ArrowRight'); await wait(360);
   assert.equal(await focusedChar(),id);
   assert.equal(await page.locator('.char-item.focused').count(),1);
   await capture(`0${i+2}-${id}.png`);
   const before = await launchCount();
   await page.keyboard.down('Enter');
   await page.waitForFunction(n=>window.__launches.length===n+1,before);
   await page.keyboard.down('Enter'); await page.keyboard.up('Enter');
   assert.equal(await launchCount(),before+1);
   assert.deepEqual(await lastLaunch(),{id:i===4?'amazon':'netflix',params:{}});
   await resume();
   assert.equal(await focusedChar(),id);
   assert.equal(await page.locator('.launching').count(),0);
  }
  record('All five character mappings; one launch per held OK; no invented deep links; return focus restored');

  await page.mouse.move(250,400); await wait(360); assert.equal(await focusedChar(),'steve');
  await page.mouse.move(590,400); await wait(360); assert.equal(await focusedChar(),'rengoku');
  await page.mouse.move(950,400); await wait(360); assert.equal(await focusedChar(),'joe');
  await page.mouse.move(1340,400); await wait(360); assert.equal(await focusedChar(),'benjamin');
  await page.mouse.move(1650,400); await wait(360); assert.equal(await focusedChar(),'hannah');
  await page.mouse.move(20,20); await wait(360);
  assert.equal(await page.locator('.char-item.focused').count(),0);
  await page.locator('.char-hit[data-id="steve"]').click(); await wait(450);
  assert.equal((await lastLaunch()).id,'netflix'); await resume();
  record('Non-overlapping pointer targets; clear focus on leave; pointer selection launches correct app');

  await press('ArrowDown'); await wait(250);
  const mid = await page.locator('#dashboard').evaluate(e=>Number(getComputedStyle(e).opacity));
  assert.ok(mid>0 && mid<1,'Transition must interpolate rather than switch instantly');
  await wait(450); assert.equal(await appsScreen(),true);
  assert.equal(await focusedApp(),'netflix');
  await capture('07-dashboard.png');
  await press('ArrowRight'); await wait(300);
  await capture('08-app-focus.png');
  await press('Enter'); await wait(450); assert.equal((await lastLaunch()).id,'amazon'); await resume();
  assert.equal(await focusedApp(),'amazon');
  await press('ArrowRight'); await press('Enter'); await wait(450);
  assert.equal((await lastLaunch()).id,'youtube.leanback.v4'); await resume();
  record('Interpolated screen transition; Prime Video and YouTube launch; dashboard focus survives resume');

  // Every installed app can receive remote focus, including partial final rows.
  const visited = new Set();
  await press('ArrowLeft'); await press('ArrowLeft');
  const columns = await page.evaluate(()=>CONFIG.columns);
  for (let row=0; row<Math.ceil(expected.length/columns); row++) {
   for (let col=0; col<columns; col++) { visited.add(await focusedApp()); if(col<columns-1) await press('ArrowRight'); }
   for(let col=1;col<columns;col++) await press('ArrowLeft');
   // Left from a partial final row may enter utilities; the final row needs no further traversal.
   if(row<Math.ceil(expected.length/columns)-1) await press('ArrowDown');
  }
  assert.equal(visited.size,expected.length);
  record('All synchronized apps reachable with directional navigation, including final partial row');

  await press('Escape'); await wait(700); assert.equal(await appsScreen(),false);
  await press('ArrowDown'); await wait(700);
  // Return from the final grid row using the real remote path.
  for(let row=1;row<Math.ceil(expected.length/columns);row++) await press('ArrowUp');
  assert.equal(await focusedApp(),'netflix');
  const original = await page.locator('.item').evaluateAll(els=>els.map(e=>({id:e.dataset.appId,left:e.style.left,top:e.style.top})));
  const beforeEdit = await launchCount();
  await page.keyboard.down('Enter'); await page.waitForFunction(()=>document.querySelector('.moving')); await page.keyboard.up('Enter');
  assert.equal(await page.locator('.moving').count(),1);
  await press('ArrowRight'); await press('Escape');
  assert.equal(await launchCount(),beforeEdit);
  assert.deepEqual(await page.locator('.item').evaluateAll(els=>els.map(e=>({id:e.dataset.appId,left:e.style.left,top:e.style.top}))),original);
  assert.equal(await focusedApp(),'netflix');
  await page.keyboard.down('Enter'); await page.waitForFunction(()=>document.querySelector('.moving')); await page.keyboard.up('Enter');
  assert.equal(await page.locator('.moving').getAttribute('data-app-id'),'netflix');
  await press('ArrowRight');
  await press('Enter');
  const saved = await page.evaluate(()=>JSON.parse(localStorage.getItem('tvhome.order')));
  assert.equal(saved.ids[1],'netflix'); assert.equal(saved.ids[0],'amazon');
  await page.reload(); await wait(800); await press('ArrowDown'); await wait(700);
  assert.equal(await focusedApp(),'amazon');
  record('Held OK edit, Back rollback, committed order survives reload with existing storage key');

  await press('ArrowLeft'); assert.equal(await page.locator('#btnInputs').evaluate(e=>e.classList.contains('focused')),true);
  await press('Enter'); assert.equal(await page.locator('#inputsPanel').evaluate(e=>e.classList.contains('hidden')),false);
  const inputId = await page.locator('.inputRow.focused').evaluate(e=>e.appId);
  await press('Enter'); assert.equal((await lastLaunch()).id,inputId);
  await press('ArrowRight'); await press('Enter');
  assert.deepEqual(await lastLaunch(),{id:'com.palm.app.settings',params:{target:'network'}});
  await press('ArrowRight'); await press('Enter');
  assert.deepEqual(await lastLaunch(),{id:'com.palm.app.settings',params:{}});
  record('Inputs, network settings and general settings retain their launch requests');

  await page.mouse.wheel(0,-120); await wait(700); assert.equal(await appsScreen(),false);
  await page.mouse.wheel(0,120);
  for(let i=0;i<12;i++) await page.mouse.wheel(0,30);
  await wait(700); assert.equal(await appsScreen(),true);
  assert.equal(await focusedApp(),'amazon');
  await page.mouse.wheel(0,-120); await wait(700); assert.equal(await appsScreen(),false);
  await page.locator('#showApps').click(); await wait(700);
  await page.locator('#showCharacters').click(); await wait(700);
  assert.equal(await appsScreen(),false);
  record('Wheel down/up, wheel burst debounce and both pointer transition controls');

  await press('ArrowRight');
  await page.evaluate(()=>window.__failLaunch=true);
  await press('Enter'); await wait(320);
  assert.match(await page.locator('#toast').textContent(),/Can't open/);
  await resume(); await page.evaluate(()=>window.__failLaunch=false);
  const countBeforeCancel = await launchCount();
  await press('Enter'); await press('Escape'); await wait(350);
  assert.equal(await launchCount(),countBeforeCancel);
  record('Launch failure feedback and cancellation before pending launch');

  await page.emulateMedia({reducedMotion:'reduce'});
  await press('ArrowDown'); await wait(50);
  assert.equal(await appsScreen(),true);
  assert.equal(await page.locator('#dashboard').evaluate(e=>getComputedStyle(e).opacity),'1');
  assert.equal(await page.locator('.char-figure').first().evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.setViewportSize({width:3840,height:2160});
  await page.waitForFunction(()=>document.getElementById('shell').getBoundingClientRect().width===3840);
  assert.equal((await page.locator('#shell').boundingBox()).width,3840);
  await page.setViewportSize({width:1280,height:720});
  await page.waitForFunction(()=>Math.round(document.getElementById('shell').getBoundingClientRect().width)===1280);
  assert.equal(Math.round((await page.locator('#shell').boundingBox()).width),1280);
  await page.locator('#btnInputs').click();
  const panel = await page.locator('#inputsPanel').boundingBox();
  assert.ok(panel.x>=0 && panel.x+panel.width<=1280 && panel.y+panel.height<=720);
  record('Reduced motion; 4K and 720p scaling; input menu coordinate scaling');

  const emptyPage = await context.newPage(); emptyPage.on('pageerror',e=>errors.push(e.message));
  await emptyPage.route('**/apps.js',route=>route.fulfill({contentType:'text/javascript',body:'window.TV_APPS={apps:[],inputs:[]};'}));
  await emptyPage.goto(url); await emptyPage.keyboard.press('ArrowDown'); await emptyPage.waitForTimeout(700);
  assert.equal(await emptyPage.locator('.item').count(),0);
  assert.equal(await emptyPage.locator('#emptyApps').isVisible(),true);
  await emptyPage.keyboard.press('Escape');
  assert.equal(await emptyPage.evaluate(()=>document.body.classList.contains('apps-screen')),false);
  record('Empty synchronized inventory retains navigation and a truthful empty state');
  assert.deepEqual(errors,[]);
  record('No uncaught browser errors');
  fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify({browser:await browser.version(),viewport:'1920x1080',appCount:expected.length,checks:results,tvTested:false},null,2)+'\n');
 } finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
