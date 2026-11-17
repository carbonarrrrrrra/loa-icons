// Exercise saved-data validation and placement against realistic catalog updates.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../site/tools.js'), 'utf8');
const context = vm.createContext({document: {body: {dataset: {tool: 'tier'}}}});
// Initialization is browser-owned; these functions do not require a DOM.
vm.runInContext(source.slice(0, source.indexOf("Q('#undo').onclick")), context);
const run = code => vm.runInContext(code, context);
const result = code => JSON.parse(run('JSON.stringify(' + code + ')'));
run(`byId = new Map(['141101','140901','141301'].map(id=>[id,{id}]));
     save=()=>{}; renderBoard=()=>{}; renderPool=()=>{};`);
run(`board=validBoard({title:'保存済み',rows:[
 {id:'s',name:'S',color:'#f3a5b5',units:['141101','unknown','141101']},
 {id:'a',name:'A',color:'#invalid',units:['141101','140901']}
]});`);
assert.deepEqual(result('board.rows.map(r=>r.units)'), [['141101'], ['140901']]);
assert.equal(run('board.title'), '保存済み');
// A newly added character stays unassigned; existing IDs keep their positions.
assert.equal(run('board.rows.some(r=>r.units.includes("141301"))'), false);
run("move('141101','a','140901')");
assert.deepEqual(result('board.rows.map(r=>r.units)'), [[], ['141101', '140901']]);
run("move('140901','a','141101')");
assert.deepEqual(result('board.rows[1].units'), ['140901', '141101']);
run("move('141101','pool')");
assert.deepEqual(result('board.rows[1].units'), ['140901']);
const previous = result('board');
run("move('unknown','a');move('141301','missing-row')");
assert.deepEqual(result('board'), previous);
assert.deepEqual(result("[...validOwned(['141101','unknown','141101','140901'])]"), ['141101','140901']);
assert.throws(()=>run('validOwned({})'), /形式/);
assert.throws(()=>run('validBoard({rows:[]})'), /1〜30/);
assert.throws(()=>run('validBoard({rows:[{id:"same",units:[]},{id:"same",units:[]}]})'), /重複/);
assert.throws(()=>run('validBoard({rows:[{units:{}}]})'), /形式/);
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../site/catalog.json')));
assert.equal(catalog.records.find(r=>r.id==='107311').name, 'ラジラジ');
for (const [id,element] of [['100101',1],['100701',5],['105801',4],['141101',4]]) {
  assert.equal(catalog.records.find(r=>r.unit_id===id).element, element);
}
console.log('Tool state, backup validation, placement and character metadata checks passed');
