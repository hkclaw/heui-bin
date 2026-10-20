/* Locks the stop-page leave-now hint.
   LEAVE_BUFFER_MIN is one minute on top of the rounded straight-line walk.
   Catch the next vehicle when walk minutes + that buffer are still within eta minutes. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const bundlePath = path.join(root, 'assets', `index-${rev}.js`);
const src = fs.readFileSync(bundlePath, 'utf8');
const start = src.indexOf('/* WALK_BEGIN */');
const end = src.indexOf('/* WALK_END */');
assert.ok(start >= 0 && end > start, 'walk helpers missing from the snapshot bundle');
const body = src.slice(start, end);
assert.match(body, /LEAVE_BUFFER_MIN/);
assert.match(body, /one extra minute/);

const api = new Function('Ae', 'Me', 'Ne', `
  let R = null;
  let St = 'idle';
  let I = null;
  let vt = [];
  let yt = null;
  let $f = '';
  let bt = null;
  let P = null;
  let Oe = null;
  let De = null;
  let page = { name: 'eta' };
  function H() { return page; }
  ${body}
  return {
    LEAVE_BUFFER_MIN,
    walkMinutes,
    leaveCopy,
    soonestMinutes,
    viewRows,
    nextEtaMinutes,
    leaveText,
    leavePaint,
    walkHtml,
    setPos(pos, state) { R = pos; St = state; },
    setStop(stop) { I = stop; },
    setRows(rows) { vt = rows; },
    setRoute(route) { yt = route; },
    setQuery(q) { $f = q; },
    setDir(dir) { bt = dir; },
    setRail(oe, de) { Oe = oe; De = de; },
    setRoot(root) { P = root; },
    setPage(name) { page = { name }; }
  };
`)(() => 0, () => true, (origin, stop) => stop.meters);

assert.strictEqual(api.LEAVE_BUFFER_MIN, 1);
assert.strictEqual(api.walkMinutes(null), null);
assert.strictEqual(api.walkMinutes(Number.NaN), null);
assert.strictEqual(api.walkMinutes(-1), null);
assert.strictEqual(api.walkMinutes(0), 0);
assert.strictEqual(api.walkMinutes(39), 0);
assert.strictEqual(api.walkMinutes(40), 1);
assert.strictEqual(api.walkMinutes(80), 1);
assert.strictEqual(api.walkMinutes(200), 3);
assert.strictEqual(api.walkMinutes(400), 5);

assert.strictEqual(api.leaveCopy(null, 5), '');
assert.strictEqual(api.leaveCopy(2, null), '');
assert.strictEqual(api.leaveCopy(2, Number.NaN), '');
assert.strictEqual(api.leaveCopy(0, 0), '趕唔切，搭下一班');
assert.strictEqual(api.leaveCopy(0, 1), '而家走趕得切');
assert.strictEqual(api.leaveCopy(5, 6), '而家走趕得切');
assert.strictEqual(api.leaveCopy(5, 5), '趕唔切，搭下一班');
assert.strictEqual(api.leaveCopy(3, 3.9), '趕唔切，搭下一班');

const rows = [
  { route: '1', etaMinutes: 2 },
  { route: '98C', etaMinutes: 8 },
  { route: '98C', etaMinutes: 20 },
  { route: '96', etaMinutes: null },
  { route: '960', etaMinutes: 4 }
];
api.setStop({ type: 'kmb', meters: 400, lat: 22.28, lng: 114.15, name_tc: '中環' });
api.setPos({ lat: 22.28, lng: 114.15 }, 'ok');
api.setRows(rows);
api.setRoute('98C');
assert.strictEqual(api.nextEtaMinutes(), 8);
assert.strictEqual(api.leaveText(), '而家走趕得切');

api.setRoute(null);
api.setQuery('98');
assert.strictEqual(api.nextEtaMinutes(), 8);
api.setQuery('96');
assert.strictEqual(api.nextEtaMinutes(), 4);
api.setQuery('');
assert.strictEqual(api.nextEtaMinutes(), 2);
assert.strictEqual(api.leaveText(), '趕唔切，搭下一班');

api.setRows([{ route: '98C', etaText: '暫時沒有班次', etaMinutes: null }]);
api.setRoute('98C');
assert.strictEqual(api.nextEtaMinutes(), null);
assert.strictEqual(api.leaveText(), '');

api.setRows(rows);
api.setRoute('98C');
api.setPos(null, 'denied');
assert.strictEqual(api.leaveText(), '');
api.setPos({ lat: 22.28, lng: 114.15 }, 'ok');

const railRows = [{ route: '屯馬線', etaMinutes: 1 }];
api.setStop({ type: 'mtr', meters: 80 });
api.setRows(railRows);
api.setRoute(null);
api.setRail(
  () => ({
    cols: [
      { key: 'up', rows: [{ etaMinutes: 3 }] },
      { key: 'down', rows: [{ etaMinutes: 12 }] }
    ],
    fastestKey: 'up'
  }),
  (cols, selected, fastest) => (selected && cols.some((col) => col.key === selected) ? selected : fastest)
);
api.setDir(null);
assert.strictEqual(api.nextEtaMinutes(), 3);
api.setDir('down');
assert.strictEqual(api.nextEtaMinutes(), 12);
assert.strictEqual(api.leaveText(), '而家走趕得切');

api.setStop({ type: 'lrt', meters: 400 });
api.setRows([{ route: '610', etaMinutes: 9 }, { route: '751', etaMinutes: 2 }]);
api.setDir('down');
assert.strictEqual(api.nextEtaMinutes(), 2);

function makeRoot(error) {
  const leave = {
    hidden: true,
    textContent: '',
    classList: {
      names: new Set(),
      toggle(name, on) { if (on) this.names.add(name); else this.names.delete(name); },
      remove(...dropped) { for (const name of dropped) this.names.delete(name); },
      has(name) { return this.names.has(name); }
    }
  };
  return {
    leave,
    querySelector(sel) {
      if (sel === '#eta-leave') return leave;
      if (sel === '#eta-body .state-error') return error ? {} : null;
      return null;
    }
  };
}

api.setStop({ type: 'kmb', meters: 400, lat: 22.28, lng: 114.15 });
api.setRows([{ route: '98C', etaMinutes: 8 }]);
api.setRoute('98C');
const page = makeRoot(false);
api.setRoot(page);
api.leavePaint();
assert.strictEqual(page.leave.hidden, false);
assert.strictEqual(page.leave.textContent, '而家走趕得切');
assert.ok(page.leave.classList.has('is-make'));
assert.ok(!page.leave.classList.has('is-miss'));

api.setRows([{ route: '98C', etaMinutes: 4 }]);
api.leavePaint();
assert.strictEqual(page.leave.textContent, '趕唔切，搭下一班');
assert.ok(page.leave.classList.has('is-miss'));
assert.ok(!page.leave.classList.has('is-make'));

const failed = makeRoot(true);
api.setRoot(failed);
api.leavePaint();
assert.strictEqual(failed.leave.hidden, true);
assert.strictEqual(failed.leave.textContent, '');

api.setRoot(page);
api.setPage('home');
page.leave.textContent = '而家走趕得切';
page.leave.hidden = false;
api.leavePaint();
assert.strictEqual(page.leave.textContent, '而家走趕得切');
api.setPage('eta');
api.setPos(null, 'pending');
api.leavePaint();
assert.strictEqual(page.leave.hidden, true);
assert.strictEqual(page.leave.textContent, '');

const html = api.walkHtml({ lat: 22.28181, lng: 114.15722, name_tc: '中環' });
assert.match(html, /id="eta-leave"/);
assert.match(html, /hidden/);
assert.match(html, /aria-live="polite"/);
assert.ok(!html.includes('而家走趕得切'));
assert.ok(!html.includes('趕唔切'));

assert.ok(src.includes('armCheck(n,r),leavePaint()'), 'ETA refresh must repaint the hint');
assert.ok(src.includes('</div>`,leavePaint()}finally'), 'a failed ETA load must clear the hint');
assert.ok(src.includes('syncEtaHash();let n=P.querySelector(`#eta-body`);n&&vt.length&&(paintEta(n,I.type,vt,I));leavePaint();'));
assert.ok(src.includes('t&&(paintEta(t,I.type,vt,I));leavePaint();'));
assert.ok(src.includes('leavePaint();let a=P.querySelector(`#eta-route-q`)'));
assert.ok(src.includes('i.textContent=r}leavePaint()'), 'a location fix must repaint the hint');

const details = fs.readFileSync(path.join(root, 'assets', 'eta-details.css'), 'utf8');
assert.match(details, /\.eta-leave\[hidden\]/);
assert.match(details, /\.eta-leave\.is-make/);
assert.match(details, /\.eta-leave\.is-miss/);

console.log('leave hint ok');
