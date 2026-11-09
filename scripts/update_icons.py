import json,re,hashlib,pathlib,urllib.request,concurrent.futures,datetime,sqlite3,tempfile
import UnityPy
UnityPy.config.FALLBACK_UNITY_VERSION='2022.3.21f1'
ROOT=pathlib.Path(__file__).resolve().parents[1]/'site'
BASE='https://carbonarrrrrrra.github.io/loa-icons/'
def get(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Astrum-Icons'}),timeout=60) as r:return r.read()
# Read the actual master database: the CSV mirror can lag behind this repository.
REPOSITORY='Expugn/priconne-database'
TABLE='v1_72eed14207272e0d9d1649016bfed38f55836b5903f391671de1b08c0ac21aaa'
COLUMNS={
 'unit_id':'ba5a643a8b0133811bc78891ff90322b4fa23b060d546e448303e26302c77d16',
 'name':'06d2df380b921fbca33847d924e8a0535ea5c38f51859ce720f79226de362733',
 'kana':'602279b192e39c6df9c8e4c4300505be7f3e4aa64662bbad30069404da08c2d5',
 'start_time':'d59c8fd0b7288d852c99f54a233bb419846af505aae69fc12545a2744915c7e2',
}
def read_names(data):
 with tempfile.NamedTemporaryFile(suffix='.db') as f:
  f.write(data);f.flush()
  with sqlite3.connect('file:'+f.name+'?mode=ro',uri=True) as db:
   columns={r[1] for r in db.execute('PRAGMA table_info("'+TABLE+'")')}
   if not set(COLUMNS.values()) <= columns:raise ValueError('Master schema changed; refusing to publish')
   rows=db.execute('SELECT '+','.join('"'+c+'"' for c in COLUMNS.values())+' FROM "'+TABLE+'"').fetchall()
 names={str(r[0])[:4]:dict(zip(COLUMNS,map(str,r))) for r in rows if re.fullmatch(r'1\d{5}',str(r[0]))}
 if names.get('1001',{}).get('name')!='ヒヨリ' or len(names)<300:raise ValueError('Invalid unit master')
 return names

def load_master(old):
 sha=json.loads(get('https://api.github.com/repos/'+REPOSITORY+'/commits/master'))['sha']
 raw='https://raw.githubusercontent.com/'+REPOSITORY+'/'+sha+'/'
 version=str(json.loads(get(raw+'version.json'))['JP']['version'])
 if not re.fullmatch(r'\d{8}',version) or int(version)<int(old['version']):raise ValueError('Invalid or regressed JP version')
 pointer=get(raw+'master_jp.db').decode()
 digest=re.search(r'^oid sha256:([0-9a-f]{64})$',pointer,re.M)
 size=re.search(r'^size (\d+)$',pointer,re.M)
 if not digest or not size:raise ValueError('Invalid database LFS pointer')
 digest=digest[1]
 if old.get('database_sha256')==digest and old.get('master_names'):
  names=old['master_names']
 else:
  data=get('https://media.githubusercontent.com/media/'+REPOSITORY+'/'+sha+'/master_jp.db')
  if len(data)!=int(size[1]) or hashlib.sha256(data).hexdigest()!=digest:raise ValueError('Database checksum mismatch')
  names=read_names(data)
 return version,names,sha,digest

def main():
 old=json.loads((ROOT/'catalog.json').read_text())
 v,names,sha,digest=load_master(old)
 print('Master database version:',v,'commit:',sha)
 manifest=get('https://prd-priconne-redive.akamaized.net/dl/Resources/'+v+'/Jpn/AssetBundles/iOS/manifest/unit2_assetmanifest').decode()
 items=re.findall(r'^a/unit_icon_unit_(1\d{5})\.unity3d,([^,]+),([^,]+),[^,]*,(\d+)',manifest,re.M)
 assert len(items)>=len(old['records'])*.9,'Unexpectedly incomplete manifest'
 previous={r['id']:r for r in old['records']}
 def extract(item):
  uid,md5,path,size=item;dst=ROOT/'icons'/(uid+'.webp')
  prior=previous.get(uid,{})
  if prior.get('md5')!=md5 or not dst.exists():
   data=get('https://prd-priconne-redive.akamaized.net/dl/pool/AssetBundles/'+path[:2]+'/'+path)
   assert len(data)==int(size) and hashlib.md5(data).hexdigest()==md5
   images=[o.read() for o in UnityPy.load(data).objects if o.type.name=='Texture2D']
   images=[o.image for o in images if o.m_Name=='icon_unit_'+uid]
   assert len(images)==1
   images[0].save(dst,'WEBP',lossless=True)
  return dict(id=uid,**names.get(uid[:4],dict(unit_id=uid[:4]+'01',name='名前未登録',kana='',start_time='')),variant=uid[-2:],url='icons/'+uid+'.webp',width=128,height=128,md5=md5,bundle_path=path)
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:records=list(pool.map(extract,items))
 records.sort(key=lambda r:(r['unit_id'],r['id']),reverse=True)
 changed=records!=old['records'] or old['version']!=v
 result=dict(old,records=records,version=v,characters=len({r['unit_id'] for r in records}),images=len(records),database_sha256=digest,master_names=names)
 if changed:result['updated']=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
 (ROOT/'catalog.json').write_text(json.dumps(result,ensure_ascii=False))
 source=dict(version=v,extracted_on=result['updated'],images=len(records),units=result['characters'],scope=result['scope'],manifest='https://prd-priconne-redive.akamaized.net/dl/Resources/'+v+'/Jpn/AssetBundles/iOS/manifest/unit2_assetmanifest',names='https://github.com/'+REPOSITORY+'/tree/'+sha,database_sha256=digest,format='WebP lossless',checks='Master database SHA256 and bundle sizes/MD5 validated before extraction.',automatic_updates=True)
 (ROOT/'source.json').write_text(json.dumps(source,ensure_ascii=False,indent=2))
 print('Validated',len(records),'icons; changed:',changed)
if __name__=='__main__':main()
