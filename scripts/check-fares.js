/* Locks adult/concession fare text on cards and ETA rows. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rev = fs.readFileSync(path.join(root, 'rev.txt'), 'utf8').trim();
const bundle = fs.readFileSync(path.join(root, 'assets', `index-${rev}.js`), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', `index-${rev}.css`), 'utf8');
const shell = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const fares = JSON.parse(fs.readFileSync(path.join(root, 'data', 'fares.json'), 'utf8'));

assert.strictEqual(fares.source, 'https://data.hkbus.app/routeFareList.min.json');
assert.ok(fares.kmb && fares.ctb);
assert.ok(Object.keys(fares.kmb).length > 5000);
assert.ok(Object.keys(fares.ctb).length > 2000);

const start = bundle.indexOf('/* FARE_BEGIN */');
const end = bundle.indexOf('/* FARE_END */');
assert.ok(start >= 0 && end > start);
const api = new Function(`${bundle.slice(start, end)}
  return { fareMoney, farePack, farePick, fareAt, fareFor, load(db){ fareDb = db; } };
`);
const fare = api();
fare.load(fares);

const chuk = { type: 'kmb', id: '18492910339410B1' };
const cultural = { type: 'kmb', id: 'A6AED77D365E7011' };
const central = { type: 'ctb', id: '001027' };
const arbuthnot = { type: 'ctb', id: '001001' };

const chukBays = {
  type: 'kmb',
  id: '18492910339410B1',
  memberIds: ['18492910339410B1', '785985F99EE00AE4', '53F544F4B03B5AE4', '272546A2E2F4FCEF', '65E3545412EECF41', '2BF46D2A46F5451D'],
};
assert.strictEqual(fare.fareFor(chukBays, '2B'), '<span class="fare" title="成人 $5.6">$5.6</span>');
assert.strictEqual(fare.fareFor(chukBays, '11K', 'O'), '<span class="fare" title="成人 $5.8">$5.8</span>');
assert.strictEqual(fare.fareFor(chukBays, '11K', 'I'), '');
assert.strictEqual(fare.fareFor(chuk, '1', 'O', 1), '<span class="fare" title="成人 $6.7">$6.7</span>');
assert.strictEqual(fare.fareFor(chuk, '1', 'I', 1), '');
assert.strictEqual(fare.fareFor(chuk, '1'), '<span class="fare" title="成人 $6.7">$6.7</span>');
assert.strictEqual(fare.fareFor(cultural, '1', 'O'), '<span class="fare" title="成人 $5.8">$5.8</span>');
assert.strictEqual(fare.fareFor(central, '1', 'O'), '<span class="fare" title="成人 $4.8">$4.8</span>');
assert.strictEqual(fare.fareFor(arbuthnot, '13', 'O'), '<span class="fare" title="成人 $6.8">$6.8</span>');
assert.strictEqual(fare.fareFor(arbuthnot, '12'), '');
assert.strictEqual(fare.fareFor({ type: 'lrt', id: '001' }, '610'), '');
assert.strictEqual(fare.fareFor({ type: 'mtr', id: 'TUM' }, 'TML'), '');
assert.strictEqual(fare.fareFor(null, '1'), '');

fare.load({ kmb: { S: { '1': '12.0/6.0', '2': 'O:6.1,I:14.7', '3': 'O2:6.3,O3:7.4', '4': '0', '5': '6.7/6.7' } } });
const stop = { type: 'kmb', id: 'S' };
assert.ok(fare.fareFor(stop, '1').includes('$12.0'));
assert.ok(fare.fareFor(stop, '1').includes('$6.0'));
assert.ok(fare.fareFor(stop, '1').includes('優惠'));
assert.strictEqual(fare.fareFor(stop, '2'), '');
assert.strictEqual(fare.fareFor(stop, '2', 'I'), '<span class="fare" title="成人 $14.7">$14.7</span>');
assert.strictEqual(fare.fareFor(stop, '2', 'O', 1), '<span class="fare" title="成人 $6.1">$6.1</span>');
assert.strictEqual(fare.fareFor(stop, '3', 'O', 3), '<span class="fare" title="成人 $7.4">$7.4</span>');
assert.strictEqual(fare.fareFor(stop, '3', 'O', 1), '');
assert.strictEqual(fare.fareFor(stop, '3'), '');
assert.strictEqual(fare.fareFor(stop, '4'), '');
assert.strictEqual(fare.fareFor(stop, '5'), '<span class="fare" title="成人 $6.7">$6.7</span>');
fare.load({ kmb: { A: { '1': 'O:6.7' }, B: { '1': 'O:5.8' } } });
const split = { type: 'kmb', id: 'A', memberIds: ['A', 'B'] };
assert.strictEqual(fare.fareFor(split, '1'), '');
assert.strictEqual(fare.fareFor(split, '1', 'O'), '<span class="fare" title="成人 $6.7">$6.7</span>');
assert.strictEqual(fare.fareMoney('0'), '');
assert.strictEqual(fare.fareMoney('12'), '12.0');

assert.ok(bundle.includes('await fareP'));
assert.ok(bundle.includes('fetch(ie(`/data/fares.json`))'));
assert.ok(bundle.includes('dir:e.dir,serviceType:e.service_type'));
assert.ok(bundle.includes('dir:a.dir||void 0,serviceType:a.service_type'));
assert.ok(bundle.includes('fareFor(e,t)'));
assert.ok(bundle.includes('fareFor(e,route)'));
assert.ok(bundle.includes('fareFor(e,s)'));
assert.ok(bundle.includes('fareFor(I,e.route,e.dir,e.serviceType)'));
assert.ok(bundle.includes('fareFor(stop,e.route,e.dir,e.serviceType)'));
assert.ok(bundle.includes('fareFor(e,e.route)'));
assert.ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('data/fares.json'));
for (const sheet of [css, shell]) {
  assert.ok(sheet.includes('.fare{color:#c5d4dc'));
  assert.ok(sheet.includes('.fare-conc'));
}

console.log(`fares ok (kmb ${Object.keys(fares.kmb).length}, ctb ${Object.keys(fares.ctb).length})`);
