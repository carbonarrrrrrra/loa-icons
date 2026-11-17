const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {deflateSync} = require('node:zlib');
const share = require('../site/share.js');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../site/catalog.json')));
const roster = [...new Set(catalog.records.map(r => r.unit_id))];
const view = {search:'',sort:'name',owned:'all',attack:'all',element:0,special:false};
const rawURL = p => '1j.' + Buffer.from(JSON.stringify(p)).toString('base64url');

(async () => {
  const original = {title:'クラン用 / 評価表 🐎', rows:[
    {id:'custom-1',name:'最優先 S+',color:'#eeaabb',units:['141101','140901']},
    {id:'custom-2',name:'保留',color:'#aaddff',units:[]}
  ]};
  const payload = share.create('tier', original, roster, {...view,owned:'yes'});
  const encoded = await share.encode(payload);
  const decoded = await share.decode(encoded);
  assert.equal(decoded.kind, 'tier');
  assert.equal(decoded.data.title, original.title);
  assert.deepEqual(decoded.data.rows.map(({id,...r})=>r), original.rows.map(({id,...r})=>r));
  assert.equal(decoded.view.owned, 'all'); // Never disclose a tier creator's ownership.
  assert.equal(encoded, new URL('https://example.com/tier.html#share='+encoded).hash.slice(7));
  original.rows[0].units.pop();
  assert.equal((await share.decode(encoded)).data.rows[0].units.length, 2);
  // Uncompressed fallback works, including Unicode and exact unit order.
  assert.deepEqual(await share.decode(rawURL(payload)), decoded);
  const mine=['141101','140901'];
  const ownPayload=share.create('owned',mine,roster,{...view,search:'ア',owned:'yes',element:4});
  const ownEncoded=await share.encode(ownPayload), owned=await share.decode(ownEncoded);
  assert.deepEqual(owned.data, [...mine].sort());
  assert.equal(owned.view.search, 'ア');
  assert.equal(owned.view.owned, 'yes');
  assert.equal(owned.view.element, 4);
  assert.equal(owned.roster.length, roster.length); // Freeze the denominator at sharing time.
  assert.equal(owned.roster.includes('199901'),false); // Future units are not implicitly unowned.
  assert.deepEqual((await share.decode(await share.encode(share.create('owned',[],roster,view)))).data,[]);
  const shuffled=[...roster].sort((a,b)=>(Number(a)*31%997)-(Number(b)*31%997));
  const large={title:'全キャラ',rows:Array.from({length:30},(_,i)=>({name:'Tier '+i,color:'#aabbcc',units:shuffled.filter((_,j)=>j%30===i)}))};
  const largeURL=await share.encode(share.create('tier',large,roster,view));
  assert.equal((await share.decode(largeURL)).data.rows.flatMap(r=>r.units).length,roster.length);
  const broken=[encoded.slice(0,-5),'2z.abc','1j._',rawURL({...payload,k:'other'}),rawURL({...payload,c:''}),rawURL({...payload,r:[]}),rawURL({...payload,f:['', 'bad','all','all',0,false]})];
  for(const data of broken) await assert.rejects(share.decode(data),/共有URL/);
  const duplicate=JSON.parse(JSON.stringify(payload));duplicate.r[1][2]=duplicate.r[0][2];
  await assert.rejects(share.decode(rawURL(duplicate)),/共有URL/);
  await assert.rejects(share.decode('1j.'+'a'.repeat(24001)),/共有URL/);
  await assert.rejects(share.decode('1z.'+deflateSync(Buffer.alloc(1000000,32)).toString('base64url')),/共有URL/);
  // Read-only snapshots cannot accidentally persist changes through editor handlers.
  const source=fs.readFileSync(path.join(__dirname,'../site/tools.js'),'utf8');
  let writes=0;
  const context=vm.createContext({document:{body:{dataset:{tool:'tier'}}},localStorage:{setItem(){writes++}}});
  vm.runInContext(source.slice(0,source.indexOf("Q('#undo').onclick")),context);
  vm.runInContext("sharedView=true;checkpoint();save();move('141101','tier-0');reorder(0,1)",context);
  assert.equal(writes,0);assert.equal(vm.runInContext('history.length',context),0);
  console.log(`PASS: URL snapshots, Unicode, filters, frozen roster, malformed/oversized data, read-only safety (tier ${encoded.length}, owned ${ownEncoded.length}, all-units tier ${largeURL.length} URL-data characters)`);
})().catch(error=>{console.error(error);process.exitCode=1});
