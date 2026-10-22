/*
 * Cinematic home for webOS: a character showcase and a separate floating app dashboard.
 *
 * webOS does not let third-party apps list installed apps, so sync-apps.py writes them into apps.js.
 */
(function () {
  'use strict';

  var COLUMNS = Math.max(1, Math.min(6, Math.floor(Number(CONFIG.columns) || 4)));
  var TILE_W = Math.min(340, Math.floor((1528 - (COLUMNS - 1) * 56) / COLUMNS)), TILE_H = 200;   // neat 16:9 floating cards
  var GAP_X = 56;                // neat, consistent gap between cards
  var ROW_PITCH = 280;           // vertical spacing between grid rows
  var DOCK_TOP = 365;            // tile top of the dock row
  var DOCK_GAP = 16;
  var VIEW_TOP = 335, VIEW_BOTTOM = 925;

  var TOTAL_ROW_W = COLUMNS * TILE_W + (COLUMNS - 1) * GAP_X;
  var ROW_START_X = Math.round((1920 - TOTAL_ROW_W) / 2);

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, OK: 13, BACK: 461, ESC: 27 };

  var GREETINGS = [[5, 'Good night'], [12, 'Good morning'], [17, 'Good afternoon'], [22, 'Good evening'], [24, 'Good night']];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December'];

  var ICON_INPUT = 'M18,7V4c0,-1.1 -0.9,-2 -2,-2H8C6.9,2 6,2.9 6,4v3H5v6l3,6v3h8v-3l3,-6V7H18zM8,4h8v3h-2V5h-1v2h-2V5h-1v2H8V4z';
  var ICON_LIVETV = 'M21,6h-7.59l3.29,-3.29L16,2l-4,4l-4,-4l-0.71,0.71L10.59,6H3c-1.1,0 -2,0.89 -2,2v12c0,1.1 0.9,2 2,2h18c1.1,0 2,-0.89 2,-2V8C23,6.89 22.1,6 21,6zM21,20H3V8h18V20zM9,10v8l7,-4L9,10z';

  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage'), tilesEl = $('tiles');
  var pills = [$('btnInputs'), $('btnWifi'), $('btnSettings')];
  var panel = $('inputsPanel');

  var items = [];               // {app, el, color}
  var zone = 'none';            // 'grid' | 'characters' | 'top' | 'inputs'
  var focused = 0, pillFocus = 0, inputFocus = 0, inputRows = [];
  var offset = 0;
  var editing = null;           // {item, snapshot} while a tile is being moved

  var characters = (window.CHARACTERS_CONFIG && CHARACTERS_CONFIG.enabled && CHARACTERS_CONFIG.characters) || [];
  var charItems = [];
  var charFocus = 0;
  var isLaunchingChar = false;
  var charHasFocus = false, screen = 'characters', screenUntil = 0;
  var launchTimer = null, launchResetTimer = null, launchingTile = null;
  var inputMode = 'remote', canvasScale = 1;
  var pointerX = null, pointerY = null, pointerMoved = false;
  // Layout changes can synthesize mouse events at an unchanged cursor position.
  // Only a real coordinate change may take control away from directional input.
  document.addEventListener('mousemove', function (e) {
    pointerMoved = e.clientX !== pointerX || e.clientY !== pointerY;
    pointerX = e.clientX; pointerY = e.clientY;
  }, true);
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function motionDuration(ms) { return reducedMotion.matches ? 0 : ms; }

  function fitCanvas() {
    canvasScale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    var shell = $('shell');
    shell.style.transform = 'scale(' + canvasScale + ')';
    shell.style.left = ((window.innerWidth - 1920 * canvasScale) / 2) + 'px';
    shell.style.top = ((window.innerHeight - 1080 * canvasScale) / 2) + 'px';
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();
  document.documentElement.style.setProperty('--tile-w', TILE_W + 'px');

  function cancelOk() { clearTimeout(okTimer); okTimer = null; okDown = false; }
  function resetLaunch() {
    clearTimeout(launchTimer); clearTimeout(launchResetTimer);
    launchTimer = launchResetTimer = null;
    isLaunchingChar = false;
    document.body.classList.remove('char-launching');
    charItems.forEach(function (el) { el.classList.remove('launching'); });
    if (launchingTile) launchingTile.el.classList.remove('launching');
    launchingTile = null;
  }

  function showScreen(next) {
    if (next === screen || editing || isLaunchingChar || launchingTile) return;
    if (next === 'characters' && !characters.length) return;
    cancelOk();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    panel.classList.add('hidden');
    setZone('none');
    screen = next;
    screenUntil = Date.now() + motionDuration(650);
    document.body.classList.toggle('apps-screen', next === 'apps');
    $('dashboard').setAttribute('aria-hidden', next !== 'apps');
    $('characterGallery').setAttribute('aria-hidden', next !== 'characters');
    if (next === 'apps') {
      if (items.length) focusTile(focused); else focusPill(0);
    } else if (charHasFocus) focusCharacter(charFocus);
    else setZone('characters');
    updateTabStops();
  }

  function updateTabStops() {
    document.querySelectorAll('.char-hit').forEach(function (el) { el.tabIndex = screen === 'characters' ? 0 : -1; });
    $('showApps').tabIndex = screen === 'characters' ? 0 : -1;
    $('showCharacters').tabIndex = screen === 'apps' && characters.length ? 0 : -1;
    pills.forEach(function (el) { el.tabIndex = screen === 'apps' ? 0 : -1; });
    items.forEach(function (it, i) { it.el.tabIndex = screen === 'apps' && i === focused ? 0 : -1; });
  }

  // ---- luna bus ------------------------------------------------------------------------------

  var bridges = [];   // keep a reference: a collected bridge drops its callback

  function luna(uri, params, cb) {
    try {
      var b = new PalmServiceBridge();
      b.onservicecallback = function (msg) {
        var res;
        try { res = JSON.parse(msg); } catch (e) { res = { returnValue: false }; }
        if (cb) cb(res);
        if (!params || !params.subscribe) bridges.splice(bridges.indexOf(b), 1);
      };
      bridges.push(b);
      b.call(uri, JSON.stringify(params || {}));
    } catch (e) {
      if (cb) cb({ returnValue: false, errorText: String(e) });   // not on a TV (desktop preview)
    }
  }

  function launch(id, title, params) {
    luna('luna://com.webos.applicationManager/launch', { id: id, params: params || {} }, function (res) {
      if (res.returnValue === false) toast("Can't open " + (title || id));
    });
  }

  var toastTimer;
  function toast(text) {
    var t = $('toast');
    t.textContent = text;
    t.classList.add('shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('shown'); }, 2200);
  }

  // ---- apps ----------------------------------------------------------------------------------

  function orderedApps() {
    var all = (window.TV_APPS && TV_APPS.apps) || [];
    var byId = {};
    all.forEach(function (a) { byId[a.id] = a; });
    var hidden = {};
    (CONFIG.hiddenApps || []).forEach(function (id) { hidden[id] = true; });
    var byTitle = function (a, b) { return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1; };

    // An order arranged on the TV wins, until dockApps in config.js changes.
    var saved = loadOrder();
    if (saved) {
      var placed = [];
      saved.forEach(function (id) {
        if (byId[id] && !hidden[id]) { placed.push(byId[id]); hidden[id] = true; }
      });
      return placed.concat(all.filter(function (a) { return !hidden[a.id]; }).sort(byTitle));
    }

    var dock = [];
    (CONFIG.dockApps || []).forEach(function (id) {
      if (byId[id] && !hidden[id] && dock.length < COLUMNS) { dock.push(byId[id]); hidden[id] = true; }
    });
    var rest = all.filter(function (a) { return !hidden[a.id]; });
    rest.sort(byTitle);
    return dock.concat(rest);
  }

  var ORDER_KEY = 'tvhome.order';

  function loadOrder() {
    try {
      var s = JSON.parse(localStorage.getItem(ORDER_KEY));
      return s && Array.isArray(s.ids) && s.dock === (CONFIG.dockApps || []).join(',') ? s.ids : null;
    } catch (e) {
      return null;
    }
  }

  function saveOrder() {
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify({
        dock: (CONFIG.dockApps || []).join(','),
        ids: items.map(function (it) { return it.app.id; })
      }));
    } catch (e) { /* storage unavailable: the order lasts until the app restarts */ }
  }

  function rowOf(i) { return Math.floor(i / COLUMNS); }
  function tileLeft(i) { return ROW_START_X + (i % COLUMNS) * (TILE_W + GAP_X); }
  function tileTop(i) { var r = rowOf(i); return DOCK_TOP + r * ROW_PITCH + (r > 0 ? DOCK_GAP : 0); }

  function build() {
    tilesEl.innerHTML = '';
    items = orderedApps().map(function (app) {
      var el = document.createElement('div');
      el.className = 'item';
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', app.title);
      el.tabIndex = -1;
      el.dataset.appId = app.id;
      var card = document.createElement('div');
      card.className = 'card';
      var img = document.createElement('img');
      var item = { app: app, el: el, card: card, color: null };
      img.onload = function () { paintTile(item, img); };
      img.alt = '';
      img.onerror = function () { img.hidden = true; el.classList.add('icon-missing'); };
      img.src = app.icon;
      card.appendChild(img);
      el.appendChild(card);
      var name = document.createElement('div');
      name.className = 'name';
      name.textContent = app.title;
      el.appendChild(name);
      el.addEventListener('mousemove', function () {
        if (!pointerMoved) return;
        inputMode = 'pointer';
        if (screen === 'apps' && zone !== 'inputs' && !editing && !launchingTile) focusTile(items.indexOf(item));
      });
      el.addEventListener('focus', function () { if (screen === 'apps' && !editing && zone !== 'inputs') focusTile(items.indexOf(item)); });
      el.addEventListener('click', function () {
        if (screen !== 'apps' || zone === 'inputs') return;
        if (editing) finishEdit(true);
        else { focusTile(items.indexOf(item)); selectTile(); }
      });
      tilesEl.appendChild(el);
      return item;
    });
    layout();
    $('appCount').textContent = String(items.length).padStart(2, '0');
    $('emptyApps').hidden = items.length > 0;
    buildCharacters();
  }

  /** Places every tile by its position in items; tiles glide when the order changes. */
  function layout() {
    items.forEach(function (it, i) {
      it.el.style.left = tileLeft(i) + 'px';
      it.el.style.top = tileTop(i) + 'px';
      it.el.classList.toggle('dock', rowOf(i) === 0);   // the dock has no labels: the top shelf names it
    });

    var band = $('dockBand');
    if (band) band.style.display = 'none';
  }

  // ---- favourite characters gallery ----------------------------------------------------------

  function buildCharacters() {
    var characterStage = $('characterStage'), targets = $('characterTargets');
    characterStage.innerHTML = ''; targets.innerHTML = ''; charItems = [];
    characters.forEach(function (c, idx) {
      var item = document.createElement('div'), g = c.composition;
      item.className = 'char-item'; item.dataset.id = c.id;
      item.style.setProperty('--left', g.left + 'px');
      item.style.setProperty('--width', g.width + 'px');
      item.style.setProperty('--top', g.top + 'px');
      item.style.setProperty('--height', g.height + 'px');
      item.style.setProperty('--layer', g.layer);
      item.style.setProperty('--label-x', g.labelX + 'px');
      item.style.setProperty('--delay', (150 + idx * 22) + 'ms');
      item.style.setProperty('--accent', c.accentColor);
      item.style.setProperty('--glow', c.glowColor);
      var figure = document.createElement('div'); figure.className = 'char-figure';
      var aura = document.createElement('div'); aura.className = 'char-aura'; figure.appendChild(aura);
      var wrap = document.createElement('div'); wrap.className = 'char-cutout-wrap';
      ['char-bloom','char-img'].forEach(function (className) {
        var img = document.createElement('img'); img.className = className;
        img.src = c.image; img.alt = ''; img.draggable = false;
        wrap.appendChild(img);
      });
      figure.appendChild(wrap); item.appendChild(figure);
      var brand = document.createElement('img'); brand.className = 'char-brand';
      brand.src = c.platformLogo; brand.alt = c.platformName; item.appendChild(brand);
      var titleWrap = document.createElement('div'); titleWrap.className = 'char-title-wrap';
      var title = document.createElement('img'); title.className = 'char-title'; title.alt = c.title;
      title.onerror = function () {
        title.hidden = true;
        var fallback = document.createElement('span'); fallback.className = 'char-title-fallback';
        fallback.textContent = c.title; titleWrap.appendChild(fallback);
        titleWrap.dataset.missingLogo = c.id;
        console.warn('Missing title logo: ' + c.logo);
      };
      title.src = c.logo; titleWrap.appendChild(title); item.appendChild(titleWrap);
      characterStage.appendChild(item); charItems.push(item);
      // Fixed, non-overlapping hit regions sit independently of the animated artwork.
      var hit = document.createElement('button'); hit.type = 'button'; hit.className = 'char-hit'; hit.dataset.id = c.id;
      hit.style.left = g.hitLeft + 'px'; hit.style.width = g.hitWidth + 'px';
      hit.setAttribute('aria-label', c.character + ' — ' + c.title + '. Open ' + c.platformName);
      hit.addEventListener('mousemove', function () { if (pointerMoved) { inputMode = 'pointer'; focusCharacter(idx); } });
      hit.addEventListener('mouseleave', function () { if (inputMode === 'pointer' && !isLaunchingChar) clearCharacterFocus(); });
      hit.addEventListener('focus', function () { focusCharacter(idx); });
      hit.addEventListener('click', function () { if (screen === 'characters') { focusCharacter(idx); selectCharacter(idx); } });
      targets.appendChild(hit);
    });
  }

  function clearCharacterFocus() {
    charItems.forEach(function (el) { el.classList.remove('focused'); });
    document.body.classList.remove('in-characters');
  }

  function focusCharacter(idx) {
    if (screen !== 'characters' || !characters.length || isLaunchingChar) return;
    charFocus = Math.max(0, Math.min(idx, characters.length - 1));
    charHasFocus = true; setZone('characters');
    document.body.classList.add('in-characters');
    charItems.forEach(function (el, i) { el.classList.toggle('focused', i === charFocus); });
  }

  function selectCharacter(idx) {
    if (isLaunchingChar || screen !== 'characters') return;
    var c = characters[idx]; if (!c) return;
    focusCharacter(idx); isLaunchingChar = true;
    charItems[idx].classList.add('launching'); document.body.classList.add('char-launching');
    launchTimer = setTimeout(function () {
      launchTimer = null; launchCharacterApp(c);
      launchResetTimer = setTimeout(resetLaunch, 900);
    }, motionDuration(260));
  }

  function selectTile() {
    if (launchingTile || screen !== 'apps' || !items[focused]) return;
    launchingTile = items[focused]; launchingTile.el.classList.add('launching');
    launchTimer = setTimeout(function () {
      launchTimer = null;
      launch(launchingTile.app.id, launchingTile.app.title);
      launchResetTimer = setTimeout(resetLaunch, 900);
    }, motionDuration(180));
  }

  function launchCharacterApp(c) {
    var params = {};
    if (c.deepLink) {
      if (c.platform === 'netflix' && c.deepLink.contentId) {
        params = { query: 'source_type=12&dial_type=app&media_id=' + c.deepLink.contentId };
      } else if (c.platform === 'amazon' && c.deepLink.asin) {
        params = { asin: c.deepLink.asin };
      }
    }
    toast('Opening ' + c.platformName);
    launch(c.platform, c.platformName + ' (' + c.title + ')', params);
  }

  function animateIn() {
    items.forEach(function (it) { it.el.classList.add('shown'); });
  }

  /** Sample each original icon once for the glass reflection; keep its artwork intact. */
  function paintTile(item, img) {
    var px = null;
    try {
      var c = document.createElement('canvas');
      c.width = 12; c.height = 12;
      var g = c.getContext('2d');
      g.drawImage(img, 0, 0, 12, 12);
      px = g.getImageData(0, 0, 12, 12).data;
    } catch (e) { /* tainted canvas: fall back to the app's colour */ }

    item.color = px ? vividColor(px) : parseColor(item.app.iconColor);
    if (item.color) item.card.style.setProperty('--reflection', item.color.join(','));
  }


  /** A vivid colour from the icon: the most saturated, not too dark pixel, or the lifted average. */
  function vividColor(px) {
    var best = null, bestScore = -1, sum = [0, 0, 0], n = 0;
    for (var i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 128) continue;
      var p = [px[i], px[i + 1], px[i + 2]];
      sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2]; n++;
      var hsv = rgbToHsv(p);
      var score = hsv[1] * Math.min(1, hsv[2] * 1.4);
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (!n) return [68, 68, 68];
    if (bestScore < 0.25) {   // nearly monochrome icon (e.g. white): its average, lifted
      var avg = rgbToHsv([sum[0] / n, sum[1] / n, sum[2] / n]);
      avg[2] = Math.max(avg[2], 0.55);
      return hsvToRgb(avg);
    }
    var h = rgbToHsv(best);
    h[1] = Math.min(1, h[1] * 1.1);
    h[2] = Math.max(0.5, h[2]);
    return hsvToRgb(h);
  }

  function parseColor(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return null;
    var v = parseInt(m[1], 16);
    return [v >> 16 & 255, v >> 8 & 255, v & 255];
  }

  function rgbToHsv(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return [h, max ? d / max : 0, max];
  }

  function hsvToRgb(hsv) {
    var h = hsv[0], s = hsv[1], v = hsv[2];
    var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, rgb;
    if (h < 60) rgb = [c, x, 0];
    else if (h < 120) rgb = [x, c, 0];
    else if (h < 180) rgb = [0, c, x];
    else if (h < 240) rgb = [0, x, c];
    else if (h < 300) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    return rgb.map(function (k) { return Math.round((k + m) * 255); });
  }

  // ---- focus & glass -------------------------------------------------------------------------

  function focusTile(i) {
    if (!items.length || screen !== 'apps') return;
    i = Math.max(0, Math.min(i, items.length - 1));
    setZone('grid');
    if (items[focused]) items[focused].el.classList.remove('focused');
    focused = i; items[i].el.classList.add('focused');
    var top = tileTop(i);
    if (rowOf(i) === 0) offset = 0;
    else {
      if (top - offset + TILE_H + 70 > VIEW_BOTTOM) offset = top + TILE_H + 70 - VIEW_BOTTOM;
      if (top - offset - 24 < VIEW_TOP) offset = top - 24 - VIEW_TOP;
    }
    stage.style.transform = 'translateY(' + (-offset) + 'px)';
    $('appPosition').textContent = (focused + 1) + ' / ' + items.length;
    updateTabStops();
  }

  function focusPill(i) {
    if (screen !== 'apps') return;
    setZone('top');
    pills[pillFocus].classList.remove('focused');
    pillFocus = Math.max(0, Math.min(i, pills.length - 1));
    pills[pillFocus].classList.add('focused');
  }

  function setZone(z) {
    if (zone === z) return;
    if (zone === 'top') pills[pillFocus].classList.remove('focused');
    if (zone === 'grid' && items[focused]) items[focused].el.classList.remove('focused');
    if (zone === 'characters') clearCharacterFocus();
    zone = z;
  }


  // ---- top bar -------------------------------------------------------------------------------

  function updateClock() {
    var now = new Date(), h = now.getHours();
    for (var k = 0; k < GREETINGS.length; k++) {
      if (h < GREETINGS[k][0]) { $('greeting').textContent = GREETINGS[k][1]; break; }
    }
    var m = now.getMinutes();
    $('clock').textContent = ((h % 12) || 12) + ':' + (m < 10 ? '0' : '') + m;
    $('ampm').textContent = h < 12 ? 'am' : 'pm';
    $('date').textContent = DAYS[now.getDay()] + '  ' + now.getDate() + ' ' + MONTHS[now.getMonth()];
  }

  /** Shows the Wi-Fi network name when the TV reports it, otherwise the connection type. */
  function watchNetwork() {
    luna('luna://com.palm.connectionmanager/getStatus', { subscribe: true }, function (res) {
      if (res.returnValue === false && !res.wifi && !res.wired) return;
      var text = 'Wi-Fi';
      if (res.wired && res.wired.state === 'connected') text = 'Ethernet';
      else if (res.wifi && res.wifi.state === 'connected') text = res.wifi.ssid || 'Wi-Fi';
      else if (res.isInternetConnectionAvailable === false) text = 'Offline';
      $('wifiLabel').textContent = text;
    });
  }

  function activatePill(i) {
    if (i === 0) showInputs();
    else if (i === 1) launch('com.palm.app.settings', 'Settings', { target: 'network' });
    else launch('com.palm.app.settings', 'Settings');
  }

  // ---- inputs dropdown -----------------------------------------------------------------------

  function showInputs() {
    panel.innerHTML = '';
    inputRows = [];
    var inputs = (window.TV_APPS && TV_APPS.inputs) || [];
    inputs.forEach(function (inp) { addInputRow(ICON_INPUT, inp.label, inp.appId); });
    if (CONFIG.liveTvApp) {
      if (inputRows.length) panel.appendChild(Object.assign(document.createElement('div'), { className: 'separator' }));
      addInputRow(ICON_LIVETV, 'Live TV', CONFIG.liveTvApp);
    }
    if (!inputRows.length) { toast('No inputs found'); return; }

    // Hang right below the Inputs pill, at least as wide as it.
    var r = pills[0].getBoundingClientRect();
    var shellRect = $('shell').getBoundingClientRect();
    panel.style.left = ((r.left - shellRect.left) / canvasScale) + 'px';
    panel.style.top = ((r.bottom - shellRect.top) / canvasScale + 20) + 'px';
    panel.style.minWidth = Math.max(r.width / canvasScale, 300) + 'px';
    panel.classList.remove('hidden');
    pills[pillFocus].classList.remove('focused');
    setZone('inputs');
    focusInput(0);
  }

  function addInputRow(icon, label, appId) {
    var row = document.createElement('div');
    row.className = 'inputRow';
    row.setAttribute('role', 'menuitem');
    row.innerHTML = '<svg viewBox="0 0 24 24"><path d="' + icon + '"/></svg>';
    row.appendChild(document.createTextNode(label));
    var idx = inputRows.length;
    row.addEventListener('mouseover', function () { focusInput(idx); });
    row.addEventListener('click', function () { hideInputs(); launch(appId, label); });
    row.appId = appId;
    row.label = label;
    inputRows.push(row);
    panel.appendChild(row);
  }

  function focusInput(i) {
    if (inputRows[inputFocus]) inputRows[inputFocus].classList.remove('focused');
    inputFocus = Math.max(0, Math.min(i, inputRows.length - 1));
    inputRows[inputFocus].classList.add('focused');
  }

  function hideInputs() {
    panel.classList.add('hidden');
    zone = 'none';
    focusPill(0);
  }

  // ---- rearranging ---------------------------------------------------------------------------

  /** Hold OK to lift a tile; arrows move it, OK places it, Back restores its position. */
  function startEdit() {
    var it = items[focused];
    if (!it) return;
    editing = { item: it, snapshot: items.slice() };
    it.el.classList.add('moving');
    document.body.classList.add('editing');
    toast('Arrows to move  ·  OK to place  ·  Back to cancel');
  }

  function moveTo(to) {
    if (to < 0 || to >= items.length || to === focused) return;
    items.splice(to, 0, items.splice(focused, 1)[0]);
    focused = to;
    layout();
    focusTile(to);
  }

  function finishEdit(keep) {
    var it = editing.item;
    if (!keep) {
      items = editing.snapshot;
      layout();
    }
    editing = null;
    it.el.classList.remove('moving');
    document.body.classList.remove('editing');
    if (keep) saveOrder();
    focused = items.indexOf(it);
    focusTile(focused);
  }

  // ---- keys ----------------------------------------------------------------------------------

  var LONG_PRESS_MS = 600;
  var okDown = false, okTimer = null;

  // On tiles OK acts on release, so a held OK can start rearranging instead of opening the app.
  document.addEventListener('keyup', function (e) {
    if (e.keyCode !== KEY.OK) return;
    e.preventDefault(); okDown = false;
    if (!okTimer) return;
    clearTimeout(okTimer); okTimer = null;
    if (zone === 'grid' && !editing) selectTile();
  });

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    if (k === 9) { // Tab is a desktop convenience; arrows remain the TV's primary input.
      e.preventDefault();
      if (editing || isLaunchingChar || launchingTile) return;
      if (zone === 'inputs') { focusInput((inputFocus + (e.shiftKey ? inputRows.length - 1 : 1)) % inputRows.length); return; }
      var nodes = Array.prototype.slice.call(document.querySelectorAll(screen === 'characters' ? '.char-hit, #showApps' : '#showCharacters, .pill, .item')).filter(function (el) { return !el.hidden; });
      var index = nodes.indexOf(document.activeElement);
      var next = nodes[(index + (e.shiftKey ? nodes.length - 1 : 1)) % nodes.length];
      // Bring clipped app rows into view before asking the browser for DOM focus.
      items.forEach(function (it, i) { if (it.el === next) focusTile(i); });
      next.focus({ preventScroll:true });
      return;
    }
    if ([KEY.LEFT,KEY.RIGHT,KEY.UP,KEY.DOWN,KEY.OK,KEY.BACK,KEY.ESC].indexOf(k) < 0) return;
    e.preventDefault(); inputMode = 'remote';
    if (k >= KEY.LEFT && k <= KEY.DOWN && document.activeElement.blur) document.activeElement.blur();
    if (isLaunchingChar || launchingTile) { if (k === KEY.BACK || k === KEY.ESC) resetLaunch(); return; }
    if (k === KEY.OK && okDown) return;
    if (k === KEY.OK) okDown = true;
    if (k !== KEY.OK && okTimer) cancelOk();
    // A held direction cannot cross a screen boundary and immediately scroll several rows.
    if (Date.now() < screenUntil && e.repeat) return;
    if (editing) {
      if (k === KEY.LEFT) moveTo(focused - 1);
      else if (k === KEY.RIGHT) moveTo(focused + 1);
      else if (k === KEY.UP) moveTo(focused - COLUMNS);
      else if (k === KEY.DOWN) moveTo(Math.min(focused + COLUMNS, items.length - 1));
      else if (k === KEY.OK) finishEdit(true);
      else if (k === KEY.BACK || k === KEY.ESC) finishEdit(false);
    } else if (zone === 'inputs') {
      if (k === KEY.UP) focusInput(inputFocus - 1);
      else if (k === KEY.DOWN) focusInput(inputFocus + 1);
      else if (k === KEY.OK) { var row = inputRows[inputFocus]; hideInputs(); launch(row.appId, row.label); }
      else if (k === KEY.BACK || k === KEY.ESC || k === KEY.LEFT || k === KEY.RIGHT) hideInputs();
    } else if (screen === 'characters') {
      if (k === KEY.LEFT) focusCharacter(charHasFocus ? charFocus - 1 : 0);
      else if (k === KEY.RIGHT) focusCharacter(charHasFocus ? charFocus + 1 : 0);
      else if (k === KEY.DOWN) showScreen('apps');
      else if (k === KEY.OK) {
        if (document.activeElement === $('showApps')) showScreen('apps');
        else selectCharacter(charFocus);
      }
      // Back at the launcher's root stays home, matching the existing launcher.
    } else if (k === KEY.OK && document.activeElement === $('showCharacters')) {
      showScreen('characters');
    } else if (zone === 'top') {
      if (k === KEY.LEFT) focusPill(pillFocus - 1);
      else if (k === KEY.RIGHT) focusPill(pillFocus + 1);
      else if (k === KEY.DOWN) { if (items.length) focusTile(focused); }
      else if (k === KEY.UP || k === KEY.BACK || k === KEY.ESC) showScreen('characters');
      else if (k === KEY.OK) activatePill(pillFocus);
    } else {
      var col = focused % COLUMNS, last = items.length - 1;
      if (k === KEY.LEFT) { if (col > 0) focusTile(focused - 1); else focusPill(0); }
      else if (k === KEY.RIGHT) { if (col < COLUMNS - 1 && focused < last) focusTile(focused + 1); }
      else if (k === KEY.UP) { if (rowOf(focused) === 0) showScreen('characters'); else focusTile(focused - COLUMNS); }
      else if (k === KEY.DOWN) { if (rowOf(focused) < rowOf(last)) focusTile(Math.min(focused + COLUMNS, last)); }
      else if (k === KEY.OK && items.length) okTimer = setTimeout(function () { okTimer = null; startEdit(); }, LONG_PRESS_MS);
      else if (k === KEY.BACK || k === KEY.ESC) showScreen('characters');
    }
  });

  pills.forEach(function (p, i) {
    p.addEventListener('mousemove', function () { if (pointerMoved && screen === 'apps' && zone !== 'inputs' && !editing) focusPill(i); });
    p.addEventListener('focus', function () { if (screen === 'apps' && zone !== 'inputs') focusPill(i); });
    p.addEventListener('click', function () { if (screen === 'apps' && !editing) activatePill(i); });
  });
  $('showApps').addEventListener('click', function () { showScreen('apps'); });
  $('showCharacters').addEventListener('click', function () { showScreen('characters'); });
  var wheelSum = 0, wheelLast = 0, wheelUntil = 0;
  document.addEventListener('wheel', function (e) {
    e.preventDefault();
    var now = Date.now();
    if (now < wheelUntil || now < screenUntil || editing || zone === 'inputs' || isLaunchingChar || launchingTile) return;
    var delta = e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? 1080 : 1);
    if (now - wheelLast > 180 || wheelSum * delta < 0) wheelSum = 0;
    wheelLast = now; wheelSum += delta;
    if (Math.abs(wheelSum) < 35) return;
    var down = wheelSum > 0; wheelSum = 0;
    wheelUntil = now + 420;
    if (screen === 'characters') { if (down) showScreen('apps'); }
    else if (!down) showScreen('characters');
    else if (items.length) focusTile(Math.min(focused + COLUMNS, items.length - 1));
  }, { passive:false });


  // ---- lifecycle -----------------------------------------------------------------------------

  /** Return from another app without losing the active screen or focused character/tile. */
  function resume() {
    cancelOk(); resetLaunch();
    clearTimeout(toastTimer); $('toast').classList.remove('shown');
    if (editing) finishEdit(false);
    updateClock(); panel.classList.add('hidden');
    setZone('none');
    if (screen === 'characters') {
      if (charHasFocus) focusCharacter(charFocus); else setZone('characters');
    } else if (items.length) focusTile(focused); else focusPill(0);
    updateTabStops();
  }


  document.addEventListener('webOSRelaunch', resume);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) resume();
    else { cancelOk(); resetLaunch(); }
  });
  window.addEventListener('blur', cancelOk);

  build();
  updateClock();
  setInterval(function () { if (!document.hidden) updateClock(); }, 30000);
  watchNetwork();
  animateIn();
  zone = 'characters';
  if (!characters.length) showScreen('apps');
  $('showCharacters').hidden = !characters.length;
  updateTabStops();
})();
