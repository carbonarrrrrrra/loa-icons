import csv,io,json,re,hashlib,pathlib,urllib.request,concurrent.futures,datetime
import UnityPy
UnityPy.config.FALLBACK_UNITY_VERSION='2022.3.21f1'
ROOT=pathlib.Path(__file__).resolve().parents[1]/'site'
BASE='https://carbonarrrrrrra.github.io/loa-icons/'
def get(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Astrum-Icons'}),timeout=60) as r:return r.read()
def main():
 old=json.loads((ROOT/'catalog.json').read_text())
 sha=json.loads(get('https://api.github.com/repos/Expugn/priconne-diff/commits/master'))['sha']
 raw='https://raw.githubusercontent.com/Expugn/priconne-diff/'+sha+'/'
 version=json.loads(get(raw+'version.json'))
 print('Version metadata:',version)
 # Accept only a numeric JP version; schema changes must fail rather than publish stale data.
 v=version.get('JP') or version.get('jp')
 if isinstance(v,dict):v=v.get('TruthVersion') or v.get('version')
 v=str(v)
 if not re.fullmatch(r'\d{8}',v):raise ValueError('Unexpected version.json schema')
 table='JP/csv/v1_72eed14207272e0d9d1649016bfed38f55836b5903f391671de1b08c0ac21aaa.csv'
 rows=list(csv.reader(io.StringIO(get(raw+table).decode('utf-8-sig'))))[1:]
 names={r[17][:4]:dict(unit_id=r[17],name=r[21],kana=r[13],start_time=r[2]) for r in rows if len(r)>21 and re.fullmatch(r'1\d{5}',r[17])}
 assert names.get('1001',{}).get('name')=='ヒヨリ','Master schema changed'
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
 result=dict(old,records=records,version=v,characters=len({r['unit_id'] for r in records}),images=len(records))
 if changed:result['updated']=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
 (ROOT/'catalog.json').write_text(json.dumps(result,ensure_ascii=False))
 source=dict(version=v,extracted_on=result['updated'],images=len(records),units=result['characters'],scope=result['scope'],manifest='https://prd-priconne-redive.akamaized.net/dl/Resources/'+v+'/Jpn/AssetBundles/iOS/manifest/unit2_assetmanifest',names='https://github.com/Expugn/priconne-diff/tree/'+sha+'/JP/csv',format='WebP lossless',checks='Source bundle sizes and MD5 validated before extraction.',automatic_updates=True)
 (ROOT/'source.json').write_text(json.dumps(source,ensure_ascii=False,indent=2))
 print('Validated',len(records),'icons; changed:',changed)
if __name__=='__main__':main()
