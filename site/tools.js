'use strict';
const Q=s=>document.querySelector(s),mode=document.body.dataset.tool,OWNKEY='loa-owned-v1',TIERKEY='loa-tiers-v1';
const elementNames=['不明','火','水','風','光','闇'];
const palette=['#f3a5b5','#f7c09c','#f2db91','#b8ddac','#a9d4ef','#c7b6e7'];
const defaults=()=>({title:'マイTier表',rows:['S','A','B','C','D'].map((name,i)=>({id:'tier-'+i,name,color:palette[i],units:[]}))});
let units=[],byId=new Map(),owned=new Set(),board=defaults(),target='tier-0',element=0,history=[],dragged=null,messageTimer,ready=false,storageBroken=false;
let sharedView=false,sharedOriginal=null,shareRoster=[],allUnits=[];
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
function button(text,fn,cls){const b=el('button',cls,text);b.type='button';b.onclick=fn;return b}
function message(t){Q('#tool-message').textContent=t;clearTimeout(messageTimer);messageTimer=setTimeout(()=>Q('#tool-message').textContent='',4000)}
function confirmAction(text){return new Promise(resolve=>{const dialog=el('dialog','tool-dialog'),message=el('p','',text),actions=el('div','dialog-actions');message.id='confirm-message';dialog.setAttribute('aria-labelledby','confirm-message');actions.append(button('キャンセル',()=>dialog.close('cancel')),button('実行する',()=>dialog.close('yes'),'primary'));dialog.append(message,actions);dialog.onclose=()=>{const result=dialog.returnValue==='yes';dialog.remove();resolve(result)};document.body.append(dialog);dialog.showModal()})}
function load(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{storageBroken=true;return fallback}}
function snapshot(){return mode==='tier'?JSON.parse(JSON.stringify(board)):[...owned]}
function checkpoint(){if(sharedView)return;history.push(snapshot());if(history.length>30)history.shift()}
function save(){if(sharedView)return;try{localStorage.setItem(mode==='tier'?TIERKEY:OWNKEY,JSON.stringify(mode==='tier'?board:[...owned]));Q('#save-status').textContent='✓ このブラウザに保存しました';storageBroken=false}catch{storageBroken=true;Q('#save-status').textContent='自動保存できません。「データを書き出す」で保存してください。'}Q('#undo').disabled=!history.length}
function validBoard(value){
 if(!value||!Array.isArray(value.rows)||value.rows.length<1||value.rows.length>30)throw Error('Tierは1〜30段にしてください');
 const seen=new Set(),rowIds=new Set();return {title:String(value.title||'マイTier表').slice(0,80),rows:value.rows.map((r,i)=>{
  if(!r||!Array.isArray(r.units))throw Error('Tierデータの形式が不正です');
  const id=typeof r.id==='string'&&/^[\w-]{1,60}$/.test(r.id)?r.id:'tier-'+i;if(rowIds.has(id))throw Error('Tier IDが重複しています');rowIds.add(id);
  return {id,name:String(r.name||'Tier').slice(0,24),color:/^#[0-9a-f]{6}$/i.test(r.color)?r.color:palette[i%palette.length],units:r.units.map(String).filter(id=>{if(!byId.has(id)||seen.has(id))return false;seen.add(id);return true})};
 })};
}
function validOwned(value){if(!Array.isArray(value)||value.length>5000)throw Error('所持データの形式が不正です');return new Set(value.map(String).filter(id=>byId.has(id)))}
function chosen(g){return g.icons.find(r=>r.variant==='61')||g.icons.find(r=>r.variant==='31')||g.icons[0]}
function standard(g){return g.element>=1&&g.element<=5&&!exceptionOrder.has(g.id)}
function filtered(){const q=Q('#tool-search').value.normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));return units.filter(g=>{
 const text=(g.name+' '+g.kana+' '+g.id+' '+g.icons.map(r=>r.id).join(' ')).normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
 return (Q('#include-special').checked||standard(g))&&(!element||g.element===element)&&text.includes(q)&&(Q('#owned-filter').value==='all'||owned.has(g.id)===(Q('#owned-filter').value==='yes'))&&(Q('#attack-filter').value==='all'||g.attack===Q('#attack-filter').value);
 }).sort(Q('#tool-sort').value==='formation'?formationCompare:Q('#tool-sort').value==='id-desc'?(a,b)=>Number(b.id)-Number(a.id):(a,b)=>a.name.localeCompare(b.name,'ja')||Number(a.id)-Number(b.id))}
function move(id,destination,before=null){if(sharedView)return;if(!byId.has(id)||!['pool',...board.rows.map(r=>r.id)].includes(destination)||id===before)return;checkpoint();for(const r of board.rows)r.units=r.units.filter(x=>x!==id);const row=board.rows.find(r=>r.id===destination);if(row){const index=row.units.indexOf(before);if(index>=0)row.units.splice(index,0,id);else row.units.push(id)}save();renderBoard();renderPool()}
function mini(g,inTier){const b=button('',()=>{if(sharedView)return;if(mode==='owned'){checkpoint();owned.has(g.id)?owned.delete(g.id):owned.add(g.id);save();renderSummary();renderPool()}else{move(g.id,inTier===target?'pool':target)}} ,'mini-card'+(mode==='owned'&&owned.has(g.id)?' owned':''));
 const r=chosen(g),im=el('img');im.src=r.url;im.alt='';im.loading='lazy';im.width=64;im.height=64;b.append(im,el('span','',g.name));
 if(g.element){const mark=el('img','element-mark');mark.src='elements/'+g.element+'.webp';mark.alt=elementNames[g.element];b.append(mark)}
 b.title=g.name+(g.element?' / '+elementNames[g.element]:'')+(Number.isFinite(g.position)?' / 隊列 '+g.position:'');b.setAttribute('aria-label',g.name+(sharedView?(mode==='owned'?(owned.has(g.id)?'：所持（閲覧用）':'：未所持（閲覧用）'):'（閲覧用）'):mode==='owned'?(owned.has(g.id)?'：所持（クリックで解除）':'：未所持（クリックで登録）'):'を選択'));if(mode==='owned')b.setAttribute('aria-pressed',String(owned.has(g.id)));
 if(mode==='tier'&&!sharedView){b.draggable=true;b.ondragstart=e=>{dragged=g.id;e.dataTransfer.setData('text/plain',g.id);e.dataTransfer.effectAllowed='move'};b.ondragend=()=>{dragged=null;document.querySelectorAll('.drop-active').forEach(n=>n.classList.remove('drop-active'))};if(inTier){b.ondragover=e=>{e.preventDefault();e.stopPropagation();b.classList.add('drop-active')};b.ondragleave=()=>b.classList.remove('drop-active');b.ondrop=e=>{e.preventDefault();e.stopPropagation();b.classList.remove('drop-active');move(dragged||e.dataTransfer.getData('text/plain'),inTier,g.id)}}}return b}
function dropZone(n,id){if(sharedView)return;n.ondragover=e=>{e.preventDefault();n.classList.add('drop-active')};n.ondragleave=e=>{if(!n.contains(e.relatedTarget))n.classList.remove('drop-active')};n.ondrop=e=>{e.preventDefault();n.classList.remove('drop-active');move(dragged||e.dataTransfer.getData('text/plain'),id)}}
function renderPool(){if(!ready)return;const assigned=new Set(board.rows.flatMap(r=>r.units));const visible=filtered().filter(g=>mode!=='tier'||!assigned.has(g.id));Q('#pool').replaceChildren(...visible.map(g=>mini(g,null)));Q('#pool').classList.toggle('owned-view',mode==='owned');Q('#tool-count').textContent=visible.length+'体を表示'+(mode==='owned'?' · 所持 '+visible.filter(g=>owned.has(g.id)).length+'体':'');Q('#no-results').hidden=!!visible.length;if(mode==='owned'&&!sharedView){Q('#bulk-actions').replaceChildren(button('表示中を所持にする',()=>bulk(true)),button('表示中を未所持にする',()=>bulk(false)));}else dropZone(Q('#pool'),'pool')}
async function bulk(yes){if(sharedView)return;const list=filtered();if(!list.length)return;if(!await confirmAction('表示中の'+list.length+'体を'+(yes?'所持':'未所持')+'に変更しますか？'))return;checkpoint();for(const g of list)yes?owned.add(g.id):owned.delete(g.id);save();renderSummary();renderPool()}
function renderElements(){Q('#elements').replaceChildren(...elementNames.map((name,i)=>{const b=button('',()=>{element=i;renderElements();renderPool()});b.setAttribute('aria-pressed',String(element===i));b.setAttribute('aria-label',i?name+'属性':'すべての属性');if(i){const im=el('img');im.src='elements/'+i+'.webp';im.alt='';b.append(im)}b.append(el('span','',i?name:'すべて'));return b}))}
function renderSummary(){const root=el('div','checker-summary');for(let i=0;i<=5;i++){const list=units.filter(g=>standard(g)&&(!i||g.element===i)),count=list.filter(g=>owned.has(g.id)).length;const n=el('div','stat');const label=el('div');if(i){const im=el('img');im.src='elements/'+i+'.webp';im.alt='';label.append(im)}label.append(el('span','',i?elementNames[i]:'全属性'));n.append(label,el('strong','',count+' / '+list.length));const bar=el('progress');bar.max=list.length||1;bar.value=count;n.append(bar,el('small','',list.length?Math.round(count/list.length*100)+'%':'0%'));root.append(n)}Q('#editor').replaceChildren(root)}
function renderBoard(){const root=Q('#editor');root.replaceChildren();const title=el('input','board-title');title.value=board.title;title.maxLength=80;title.setAttribute('aria-label','Tier表のタイトル');title.onchange=()=>{checkpoint();board.title=title.value.trim()||'マイTier表';save()};root.append(title);
 const toolbar=el('div','tier-toolbar');toolbar.append(el('span','','クリックの配置先'));const select=el('select');select.setAttribute('aria-label','クリックの配置先');for(const [id,name]of [['pool','未配置に戻す'],...board.rows.map(r=>[r.id,r.name])]){const o=el('option','',name);o.value=id;select.append(o)}if(!['pool',...board.rows.map(r=>r.id)].includes(target))target=board.rows[0].id;select.value=target;select.onchange=()=>{target=select.value;renderBoard()};toolbar.append(select,button('＋ Tierを追加',()=>{if(board.rows.length>=30)return message('Tierは30段まで追加できます');checkpoint();const id='tier-'+Date.now().toString(36);board.rows.push({id,name:'Tier '+(board.rows.length+1),color:palette[board.rows.length%6],units:[]});target=id;save();renderBoard()}));root.append(toolbar);
 const table=el('div','tier-board');table.id='tier-board';for(const [index,row]of board.rows.entries()){
 const line=el('section','tier-row'+(target===row.id?' active':''));line.setAttribute('aria-label',row.name+'のTier');line.style.setProperty('--tier-color',row.color);const label=el('div','tier-label'),name=el('input');name.type='text';name.value=row.name;name.maxLength=24;name.setAttribute('aria-label','Tier '+(index+1)+'の名前');name.onchange=()=>{checkpoint();row.name=name.value.trim()||'Tier';save();renderBoard()};label.append(name);const options=el('div','label-tools'),color=el('input');color.type='color';color.value=row.color;color.setAttribute('aria-label',row.name+'の色');color.onchange=()=>{checkpoint();row.color=color.value;save();renderBoard()};options.append(color,button(target===row.id?'配置先 ✓':'ここに配置',()=>{target=row.id;renderBoard()}));label.append(options);const slots=el('div','tier-slots');dropZone(slots,row.id);slots.append(...row.units.map(id=>mini(byId.get(id),row.id)));
 const controls=el('div','row-controls');const up=button('↑',()=>reorder(index,-1)),down=button('↓',()=>reorder(index,1)),del=button('×',async()=>{if(board.rows.length===1)return message('最低1段は残してください');if(!await confirmAction(row.name+'を削除しますか？ キャラは未配置に戻ります。'))return;checkpoint();board.rows.splice(index,1);save();renderBoard();renderPool()},'danger');up.disabled=index===0;down.disabled=index===board.rows.length-1;up.setAttribute('aria-label',row.name+'を上へ');down.setAttribute('aria-label',row.name+'を下へ');del.setAttribute('aria-label',row.name+'を削除');controls.append(up,down,del);line.append(label,slots,controls);table.append(line)
 }root.append(table,el('small','',sharedView?'共有された配置を表示しています。':'Tier内のキャラは絞り込みに関係なく全員表示します。ドラッグで好きな順番に並べられます。'));if(sharedView){root.querySelectorAll('input').forEach(n=>n.readOnly=true);root.querySelectorAll('button').forEach(n=>n.disabled=true)}}
function reorder(i,delta){if(sharedView)return;checkpoint();[board.rows[i],board.rows[i+delta]]=[board.rows[i+delta],board.rows[i]];save();renderBoard()}
function getView(){return {search:Q('#tool-search').value.slice(0,200),sort:Q('#tool-sort').value,owned:Q('#owned-filter').value,attack:Q('#attack-filter').value,element,special:Q('#include-special').checked}}
function setView(view){Q('#tool-search').value=view.search;Q('#tool-sort').value=view.sort;Q('#owned-filter').value=view.owned;Q('#attack-filter').value=view.attack;element=view.element;Q('#include-special').checked=view.special}
function ownDataLink(){const a=el('a','','自分のデータに戻る');a.href=mode+'.html';return a}
function showSharedNotice(){
 document.body.classList.add('shared-view');const notice=Q('#share-notice');notice.hidden=false;notice.replaceChildren(el('strong','','共有された'+(mode==='tier'?'Tier表':'所持状況')+' · 閲覧用'),el('p','','URLを作成した時点の内容です。このブラウザに保存済みの自分のデータは変更しません。'));
 const missing=shareRoster.filter(id=>!byId.has(id)).length;if(missing)notice.append(el('p','','現在のカタログにない'+missing+'体は表示できません。ページの再読み込みをお試しください。'));
 const actions=el('div','share-actions');actions.append(button('自分用にコピーして編集',adoptShared),ownDataLink());notice.append(actions);
 Q('#save-status').textContent='共有内容を閲覧中 · 自分のデータは保存済みのままです';
}
function showShareError(text){
 document.body.classList.add('share-error');const notice=Q('#share-notice');notice.hidden=false;notice.replaceChildren(el('strong','','共有URLを読み込めませんでした'),el('p','',text),ownDataLink());Q('#save-status').textContent='保存済みのデータは変更していません';
}
async function adoptShared(){
 if(!sharedView||!sharedOriginal)return;
 if(!await confirmAction('このブラウザに保存済みの'+(mode==='tier'?'Tier表':'所持状況')+'を、共有された内容に置き換えて編集しますか？「元に戻す」で以前のデータに戻せます。'))return;
 let previous,personalOwned=owned;try{previous=mode==='tier'?validBoard(load(TIERKEY,defaults())):[...validOwned(load(OWNKEY,[]))];if(mode==='tier')personalOwned=validOwned(load(OWNKEY,[]))}catch{message('保存済みのデータを読み込めないため、上書きしませんでした。');return}
 // Block adopting if even the existing data cannot safely be read.
 if(storageBroken){message('保存先を確認できないため、上書きしませんでした。');return}
 sharedView=false;units=allUnits;owned=personalOwned;history=[previous];document.body.classList.remove('shared-view');Q('#share-notice').hidden=true;
 window.history.replaceState(null,'',location.pathname+location.search);save();mode==='tier'?renderBoard():renderSummary();renderPool();message('自分用にコピーしました');
}
async function copyShare(){
 if(!ready)return;const control=Q('#share');control.disabled=true;control.textContent='共有URLを作成中…';
 try{
  const payload=LoaShare.create(mode,sharedView?sharedOriginal.data:snapshot(),sharedView?shareRoster:units.map(g=>g.id),getView());
  const url=new URL(mode+'.html',location.href);url.hash='share='+await LoaShare.encode(payload);
  const panel=Q('#share-link'),label=el('label','','共有URL（作成時点の内容）'),field=el('input');field.type='text';field.value=url.href;field.readOnly=true;field.setAttribute('aria-label','共有URL');field.onfocus=()=>field.select();label.append(field);const preview=el('a','','共有画面を開く ↗');preview.href=url.href;preview.target='_blank';preview.rel='noopener';panel.replaceChildren(label,preview);panel.hidden=false;
  try{await navigator.clipboard.writeText(url.href);message('共有URLをコピーしました。クランなどに貼り付けてください。')}
  catch{field.focus();field.select();message('表示されたURL全体を選択してコピーしてください。')}

 }catch(error){message(error.message)}finally{control.disabled=false;control.textContent='共有URLをコピー'}
}
function download(blob,name){const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)}
async function exportImage(){const b=Q('#download-image');b.disabled=true;try{
 const lists=mode==='tier'?board.rows.map(r=>({name:r.name,color:r.color,ids:r.units})):elementNames.slice(1).map((n,i)=>({name:n,color:palette[i],ids:filtered().filter(g=>g.element===i+1).map(g=>g.id)})).filter(r=>r.ids.length);
 if(mode==='owned'){const unknown=filtered().filter(g=>!g.element);if(unknown.length)lists.push({name:'その他',color:'#dce5ef',ids:unknown.map(g=>g.id)})}
 const perRow=10,cell=86,labelW=130,width=1020;const heights=lists.map(r=>Math.max(1,Math.ceil(r.ids.length/perRow))*cell+18);const canvas=el('canvas');canvas.width=width;canvas.height=120+heights.reduce((a,b)=>a+b,0);const ctx=canvas.getContext('2d');ctx.fillStyle='#f5f9fe';ctx.fillRect(0,0,width,canvas.height);ctx.fillStyle='#334762';ctx.font='bold 26px sans-serif';ctx.fillText((mode==='tier'?board.title:'所持キャラチェッカー').slice(0,50),24,40);ctx.font='14px sans-serif';ctx.fillText('LoA Icons'+(mode==='owned'?' · ✓ 所持 / グレー 未所持 · 現在の絞り込みで出力':''),24,68);
 const ids=[...new Set(lists.flatMap(r=>r.ids))],images=new Map();await Promise.all(ids.map(id=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images.set(id,im);resolve()};im.onerror=()=>reject(Error('画像を読み込めませんでした。再度お試しください。'));im.src=chosen(byId.get(id)).url})));
 let y=88;for(let i=0;i<lists.length;i++){const r=lists[i],h=heights[i];ctx.fillStyle=r.color;ctx.fillRect(16,y,labelW-16,h);ctx.fillStyle='#fff';ctx.fillRect(labelW,y,width-labelW-16,h);ctx.strokeStyle='#d5e0ec';ctx.strokeRect(16,y,width-32,h);ctx.fillStyle='#24364e';ctx.font='bold 16px sans-serif';for(let k=0;k<Math.ceil(r.name.length/7);k++)ctx.fillText(r.name.slice(k*7,k*7+7),26,y+32+k*23);r.ids.forEach((id,j)=>{const x=labelW+10+(j%perRow)*cell,yy=y+9+Math.floor(j/perRow)*cell;ctx.save();if(mode==='owned'&&!owned.has(id)){ctx.globalAlpha=.35;ctx.filter='grayscale(1)'}ctx.drawImage(images.get(id),x,yy,62,62);ctx.restore();if(mode==='owned'&&owned.has(id)){ctx.fillStyle='#36765c';ctx.fillRect(x+43,yy+43,19,19);ctx.fillStyle='#fff';ctx.font='bold 16px sans-serif';ctx.fillText('✓',x+44,yy+58)}ctx.fillStyle='#334762';ctx.font='9px sans-serif';ctx.fillText(byId.get(id).name.slice(0,9),x,yy+74)});y+=h}ctx.font='10px sans-serif';ctx.fillStyle='#687c93';ctx.fillText('非公式ファンツール · 画像の権利は各権利者に帰属',24,canvas.height-12);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('画像を出力できませんでした');download(blob,'loa-'+mode+'.png');message('画像を書き出しました')
 }catch(e){message(e.message)}finally{b.disabled=false}}
Q('#undo').onclick=()=>{if(sharedView||!history.length)return;const old=history.pop();if(mode==='tier')board=old;else owned=new Set(old);save();mode==='tier'?renderBoard():renderSummary();renderPool()};
Q('#reset').onclick=async()=>{if(sharedView)return;if(!await confirmAction(mode==='tier'?'Tier表を初期状態に戻しますか？':'すべての所持チェックを解除しますか？'))return;checkpoint();if(mode==='tier')board=defaults();else owned.clear();save();mode==='tier'?renderBoard():renderSummary();renderPool()};
Q('#backup').onclick=()=>download(new Blob([JSON.stringify({app:'LoA Icons',version:1,kind:mode,data:snapshot()},null,2)],{type:'application/json'}),'loa-'+mode+'-backup.json');
Q('#restore').onchange=async e=>{if(sharedView)return;const file=e.target.files[0];if(!file)return;try{if(file.size>2000000)throw Error('ファイルが大きすぎます');const data=JSON.parse(await file.text());if(data.app!=='LoA Icons'||data.version!==1||data.kind!==mode)throw Error('このページ用のLoA Iconsバックアップを選んでください');const value=mode==='tier'?validBoard(data.data):validOwned(data.data);if(!await confirmAction('現在のデータをバックアップの内容に置き換えますか？'))return;checkpoint();if(mode==='tier')board=value;else owned=value;save();mode==='tier'?renderBoard():renderSummary();renderPool();message('データを読み込みました')}catch(err){message(err.message)}finally{e.target.value=''}};
Q('#download-image').onclick=exportImage;
Q('#share').onclick=copyShare;
for(const id of ['tool-search','tool-sort','owned-filter','attack-filter','include-special'])Q('#'+id).addEventListener(id==='tool-search'?'input':'change',renderPool);
window.addEventListener('storage',e=>{if(e.key===OWNKEY&&ready&&!sharedView){try{owned=validOwned(JSON.parse(e.newValue||'[]'));if(mode==='owned')renderSummary();renderPool()}catch{}}});
for(const b of Q('.tool-actions').querySelectorAll('button'))b.disabled=true;
const shareToken=new URLSearchParams(location.hash.slice(1)).get('share');
sharedView=shareToken!==null;
if(sharedView)Q('#save-status').textContent='共有URLを読み込んでいます…';
window.addEventListener('hashchange',()=>location.reload());
fetch('catalog.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('カタログ取得に失敗しました');return r.json()}).then(async data=>{
 const map=new Map();for(const r of data.records){if(!map.has(r.unit_id))map.set(r.unit_id,{id:r.unit_id,name:r.name,kana:r.kana,position:r.position,element:r.element,attack:r.attack,icons:[]});map.get(r.unit_id).icons.push(r)}units=[...map.values()];allUnits=units;byId=map;
 if(sharedView){
  try{
   sharedOriginal=await LoaShare.decode(shareToken);
   if(sharedOriginal.kind!==mode)throw Error('このページ用の共有URLではありません。送信者にURL全体をコピーし直してもらってください。');
   shareRoster=sharedOriginal.roster;const known=new Set(shareRoster);units=allUnits.filter(g=>known.has(g.id));
   if(mode==='tier')board=validBoard(sharedOriginal.data);else owned=validOwned(sharedOriginal.data);
   setView(sharedOriginal.view);showSharedNotice();
  }catch(error){showShareError(error.message);return}
 }else{try{owned=validOwned(load(OWNKEY,[]));board=validBoard(load(TIERKEY,defaults()))}catch{storageBroken=true;message('保存データを読み込めませんでした。バックアップを読み込んでください。')}}
 ready=true;renderElements();mode==='tier'?renderBoard():renderSummary();renderPool();for(const b of Q('.tool-actions').querySelectorAll('button'))b.disabled=false;Q('#undo').disabled=true;if(storageBroken)Q('#save-status').textContent='保存データを確認できません。変更前にバックアップを確認してください。';
}).catch(()=>{if(sharedView)showShareError('カタログを読み込めませんでした。ページを再読み込みしてください。');else Q('#tool-count').textContent='読み込めませんでした。ページを再読み込みしてください。'});
