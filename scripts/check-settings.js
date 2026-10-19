/* Locks the home-header gear, the settings hash route, and the about page. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const bundle = fs.readFileSync(path.join(root, 'assets', `index-${rev}.js`), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', `index-${rev}.css`), 'utf8');
const shell = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

assert.ok(bundle.includes('if(e[0]===`settings`)return{name:`settings`}'));
assert.ok(bundle.includes('if(e[0]===`about`)return{name:`about`}'));
assert.ok(bundle.includes('e.name===`settings`?renderSettings():e.name===`about`?renderAbout()'));
assert.ok(bundle.includes('leading:settingsBtn()'));
assert.ok(bundle.includes('t?.leading??`<span class="icon-spacer"></span>`'));
assert.ok(bundle.includes('data-arm-lead'));
assert.ok(bundle.includes('armSaveLead'));
assert.ok(!bundle.includes('function armPaint(){let e=P&&P.querySelector(`[data-action="arm-light"]`);if(!e)return;'));

for (const sheet of [css, shell]) {
  assert.ok(sheet.includes('.btn.top-settings'));
  assert.ok(sheet.includes('.about-facts'));
  assert.match(sheet, /\.topbar\{[^}]*-webkit-backdrop-filter:\s*none;[^}]*backdrop-filter:\s*none;[^}]*background:\s*#0e1418/);
  assert.match(sheet, /\.topbar \.brand\{[^}]*text-shadow:\s*none/);
}
assert.ok(shell.includes('.topbar{z-index:5;padding:calc(10px + var(--safe-top)) 16px 10px'));
assert.ok(shell.includes('position:sticky;top:0'));
assert.ok(shell.includes('.topbar-row>.brand-wrap'));
assert.ok(shell.includes('left:50%'));
assert.ok(shell.includes('transform:translate(-50%,-50%)'));

const start = bundle.indexOf('/* SETTINGS_BEGIN */');
const end = bundle.indexOf('/* SETTINGS_END */');
assert.ok(start >= 0 && end > start);
const body = bundle.slice(start, end);

function render(lead) {
  const meta = { content: rev };
  const P = { innerHTML: '' };
  const api = new Function(
    'qt', 'At', 'Be', 'armClear', 'armLead', 'Tt', 'U', 'document', 'P',
    `${body}
     return { settingsBtn, appRev, renderSettings, renderAbout };`
  );
  const state = { cleared: 0 };
  const calls = () => { state.cleared += 1; };
  const html = [];
  const fns = api(
    calls, calls, calls, calls,
    () => lead,
    (inner, opts) => {
      html.push({ inner, opts });
      return inner;
    },
    (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
    { querySelector: (sel) => sel === 'meta[name="tap-eta-rev"]' ? meta : null },
    P
  );
  return { fns, html, state, P };
}

const home = render(5);
const gear = home.fns.settingsBtn();
assert.ok(gear.includes('data-nav="/settings"'));
assert.ok(gear.includes('aria-label="設定"'));
assert.ok(gear.includes('class="btn btn-ghost top-search top-settings"'));
assert.ok(gear.includes('class="gear-icon"'));
assert.strictEqual(home.fns.appRev(), rev);

home.fns.renderSettings();
assert.strictEqual(home.state.cleared, 4);
const settings = home.html[0];
assert.strictEqual(settings.opts.title, '設定');
assert.strictEqual(settings.opts.back, '/');
assert.ok(settings.inner.includes('到站提醒'));
const alight = require('../assets/alight-remind.js');
assert.ok(settings.inner.includes('落車提醒'));
assert.ok(settings.inner.includes('data-alight-disable'));
assert.ok(settings.inner.includes('停用落車提醒'));
assert.ok(settings.inner.includes('aria-pressed="true"'));
assert.ok(settings.inner.includes(alight.LIMIT_COPY));
assert.ok(settings.inner.includes('data-nav="/about"'));
assert.ok(settings.inner.includes('去邊 / heui-bin'));
for (const n of [3, 5, 8, 10]) {
  assert.ok(settings.inner.includes(`data-arm-lead="${n}"`));
}
assert.ok(settings.inner.includes('data-arm-lead="5" aria-pressed="true"'));
assert.ok(!settings.inner.includes('data-arm-lead="3" aria-pressed="true"'));

const eight = render(8);
eight.fns.renderSettings();
assert.ok(eight.html[0].inner.includes('data-arm-lead="8" aria-pressed="true"'));
assert.ok(eight.html[0].inner.includes('data-arm-lead="5" aria-pressed="false"'));

home.fns.renderAbout();
const about = home.html[1];
assert.strictEqual(about.opts.title, '關於');
assert.strictEqual(about.opts.back, '/settings');
assert.ok(about.inner.includes('>去邊</h2>'));
assert.ok(about.inner.includes('heui-bin'));
assert.ok(about.inner.includes('實時到站時間'));
assert.ok(about.inner.includes(`>${rev}</dd>`));
assert.ok(about.inner.includes('靜態 PWA，用九巴、城巴、新大嶼山同港鐵開放數據。'));
assert.ok(about.inner.includes('href="https://heuibin.codecoffee.online"'));
assert.ok(about.inner.includes('href="https://tap-eta-hk.surge.sh"'));

console.log('settings ok');
