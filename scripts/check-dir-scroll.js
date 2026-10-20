/* Direction pills (東鐵綫 往羅湖 / 往金鐘) live in a horizontal scroller.
   Selecting one, or a 20s ETA refresh, replaces #eta-body and used to
   remount that scroller at scrollLeft 0. paintEta puts the offset back. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const src = fs.readFileSync(path.join(root, 'assets', `index-${rev}.js`), 'utf8');

assert.ok(src.includes('function paintEta(el,type,rows,stop)'));
assert.ok(!src.includes('.innerHTML=Gt('), 'eta body must not remount without restoring scroll');
assert.ok(src.includes('t&&(paintEta(t,I.type,vt,I));leavePaint();'), 'tapping a direction pill repaints through paintEta');
assert.ok(src.includes('paintEta(e,n.type,r,n)'), 'ETA refresh repaints through paintEta');
assert.equal((src.match(/paintEta\(/g) || []).length, 11);

const start = src.indexOf('function paintEta(');
const end = src.indexOf('function Gt(e,t,n){if(e===`kmb`');
assert.ok(start >= 0 && end > start);
const paintEta = new Function('Gt', `${src.slice(start, end)}; return paintEta;`)(() => '<painted>');

function host(tabLeft, chipLeft) {
  let tabs = tabLeft == null ? null : { scrollLeft: tabLeft };
  let chips = chipLeft == null ? null : { scrollLeft: chipLeft };
  return {
    querySelector(sel) {
      if (sel === '.eta-dir-tabs') return tabs;
      if (sel === '.route-chips') return chips;
      return null;
    },
    set innerHTML(_html) {
      tabs = tabs ? { scrollLeft: 0 } : null;
      chips = chips ? { scrollLeft: 0 } : null;
    },
    read() {
      return { tabs: tabs && tabs.scrollLeft, chips: chips && chips.scrollLeft };
    },
  };
}

const mid = host(240, 80);
paintEta(mid, 'mtr', [], {});
assert.deepStrictEqual(mid.read(), { tabs: 240, chips: 80 });

const startRow = host(0, 0);
paintEta(startRow, 'mtr', [], {});
assert.deepStrictEqual(startRow.read(), { tabs: 0, chips: 0 });

const tabsOnly = host(160, null);
paintEta(tabsOnly, 'mtr', [], {});
assert.deepStrictEqual(tabsOnly.read(), { tabs: 160, chips: null });

assert.doesNotThrow(() => paintEta(null, 'mtr', [], {}));

console.log('dir scroll ok');
