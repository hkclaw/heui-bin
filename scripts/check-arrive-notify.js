/* Locks the install-guide copy and the 3/5/8/10 lead time. */
const assert = require('assert');
const fs = require('fs');
const api = require('../assets/arrive-notify.js');

const iosSafari = {
  ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  platform: 'iPhone',
  maxTouchPoints: 5,
  notification: false,
  displayMode: 'browser'
};
const iosStandalone = Object.assign({}, iosSafari, { standalone: true, displayMode: 'standalone' });
const iosPad = {
  ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
  platform: 'MacIntel',
  maxTouchPoints: 5,
  notification: false,
  displayMode: 'browser'
};
const androidTab = {
  ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0.0.0 Mobile Safari/537.36',
  notification: true,
  displayMode: 'browser',
  beforeInstall: true
};
const androidWebView = Object.assign({}, androidTab, { notification: false, beforeInstall: false });
const desktop = {
  ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36',
  notification: false,
  displayMode: 'browser'
};

assert.deepStrictEqual(api.LEADS, [3, 5, 8, 10]);
assert.strictEqual(api.normalizeLead(undefined), 5);
assert.strictEqual(api.normalizeLead(7), 5);
assert.strictEqual(api.normalizeLead(3), 3);
assert.strictEqual(api.normalizeLead('8'), 8);
assert.strictEqual(api.normalizeLead(10), 10);
assert.strictEqual(api.buttonLabel(5), '5分鐘前提醒');
assert.strictEqual(api.buttonLabel(3), '3分鐘前提醒');
assert.strictEqual(api.buttonLabel(8), '8分鐘前提醒');
assert.strictEqual(api.buttonLabel(10), '10分鐘前提醒');

const memory = {
  data: {},
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; },
  setItem(key, value) { this.data[key] = String(value); }
};
assert.strictEqual(api.readLead(memory), 5);
assert.strictEqual(api.writeLead(memory, 8), 8);
assert.strictEqual(memory.getItem(api.LEAD_KEY), '8');
assert.strictEqual(api.readLead(memory), 8);
assert.strictEqual(api.writeLead(memory, 6), 5);

const homeTap = api.onRemindTap(iosSafari, { permission: 'missing' });
assert.strictEqual(homeTap.type, 'sheet');
assert.strictEqual(homeTap.message, api.HOME_SCREEN_MESSAGE);
assert.ok(!homeTap.message.includes('呢部機唔支援通知'));
assert.strictEqual(api.onRemindTap(iosPad, { permission: 'missing' }).type, 'sheet');
assert.strictEqual(api.onRemindTap(androidWebView, {}).type, 'sheet');
assert.strictEqual(api.onRemindTap(androidWebView, {}).message, api.HOME_SCREEN_MESSAGE);
assert.strictEqual(api.onRemindTap(iosStandalone, { permission: 'missing' }).type, 'unsupported');
assert.strictEqual(api.onRemindTap(iosStandalone, { permission: 'missing' }).message, '呢部機唔支援通知。');
assert.strictEqual(api.onRemindTap(desktop, { permission: 'missing' }).message, '呢部機唔支援通知。');
assert.strictEqual(api.onRemindTap(androidTab, { permission: 'default' }).type, 'ask');
assert.strictEqual(api.onRemindTap(androidTab, { permission: 'granted' }).type, 'enable');
assert.strictEqual(api.onRemindTap(androidTab, { permission: 'denied' }).type, 'denied');
assert.strictEqual(api.detectInstall({
  ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36',
  platform: 'MacIntel',
  maxTouchPoints: 5,
  notification: true
}).ios, false);
assert.strictEqual(api.detectInstall(Object.assign({}, iosStandalone, { notification: true })).standalone, true);

const iosSteps = api.sheetCopy(iosSafari);
assert.deepStrictEqual(iosSteps.steps, ['撳「分享」', '揀「加入主畫面」', '用圖示開啟']);
assert.strictEqual(iosSteps.canPrompt, false);
const androidSteps = api.sheetCopy(androidTab);
assert.ok(androidSteps.steps[0].includes('選單'));
assert.ok(androidSteps.steps[1].includes('安裝應用程式'));
assert.ok(androidSteps.steps[1].includes('加到主畫面'));
assert.strictEqual(androidSteps.canPrompt, true);
const chromeIos = api.sheetCopy({
  ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) CriOS/128.0.0.0 Mobile/15E148 Safari/604.1',
  notification: false
});
assert.ok(chromeIos.note.includes('Safari'));
assert.strictEqual(api.shouldAutoShow(), false);
assert.strictEqual(api.entryVisible(iosSafari, false), true);
assert.strictEqual(api.entryVisible(iosSafari, true), false);
assert.strictEqual(api.entryVisible(iosStandalone, false), false);
api.dismissEntry(memory);
assert.strictEqual(api.entryVisible(iosSafari, api.readEntryDismissed(memory)), false);
api.dismissSheet(memory);
assert.strictEqual(memory.getItem(api.SHEET_KEY), '1');

const path = require('path');
const root = path.join(__dirname, '..');
const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const bundle = fs.readFileSync(path.join(root, 'assets', 'index-' + rev + '.js'), 'utf8');
assert.ok(bundle.includes('tap-eta-lead-min-v1'));
assert.ok(bundle.includes('HeuiArrive.missingNotification'));
assert.ok(bundle.includes('data-arm-lead'));
assert.ok(bundle.includes('呢部機唔支援通知'));
assert.ok(bundle.includes('取消提醒'));
assert.ok(!bundle.includes('mins:5}'));

console.log('arrive-notify ok');
