/* Direction pills (東鐵綫 往羅湖 / 往金鐘) live in a horizontal scroller.
   Route pills on a busy stop wrap and scroll vertically inside a two-row
   window. Selecting one, or a 20s ETA refresh, replaces #eta-body and used
   to remount those scrollers at offset 0. paintEta puts both offsets back,
   and slides a selected route pill into the window when it was clipped. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const src = fs.readFileSync(path.join(root, 'assets', `index-${rev}.js`), 'utf8');

assert.ok(src.includes('function paintEta(el,type,rows,stop)'));
assert.ok(src.includes('chipTop=chips?chips.scrollTop:0'));
assert.ok(src.includes('if(nextChips&&chipTop)nextChips.scrollTop=chipTop'));
assert.ok(src.includes('.route-chip.on'));
assert.ok(!src.includes('.innerHTML=Gt('), 'eta body must not remount without restoring scroll');
assert.ok(src.includes('t&&(paintEta(t,I.type,vt,I));leavePaint();'), 'tapping a direction pill repaints through paintEta');
assert.ok(src.includes('paintEta(e,n.type,r,n)'), 'ETA refresh repaints through paintEta');
assert.equal((src.match(/paintEta\(/g) || []).length, 13);

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

function verticalHost(startTop, layoutTop) {
  let chips;
  function makeChips(top) {
    const box = {
      scrollLeft: 0,
      scrollTop: top,
      querySelector(sel) {
        if (sel !== '.route-chip.on' || layoutTop == null) return null;
        return {
          getBoundingClientRect() {
            const y = 100 + layoutTop - box.scrollTop;
            return { top: y, bottom: y + 44 };
          },
        };
      },
      getBoundingClientRect() {
        return { top: 100, bottom: 196, height: 96 };
      },
    };
    return box;
  }
  chips = makeChips(startTop);
  return {
    querySelector(sel) {
      if (sel === '.route-chips') return chips;
      return null;
    },
    set innerHTML(_html) {
      chips = makeChips(0);
    },
    read() {
      return chips.scrollTop;
    },
  };
}

const kept = verticalHost(104, null);
paintEta(kept, 'kmb', [], {});
assert.strictEqual(kept.read(), 104);

const revealed = verticalHost(0, 140);
paintEta(revealed, 'kmb', [], {});
assert.strictEqual(revealed.read(), 88);

const already = verticalHost(0, 10);
paintEta(already, 'kmb', [], {});
assert.strictEqual(already.read(), 0);

console.log('dir scroll ok');
