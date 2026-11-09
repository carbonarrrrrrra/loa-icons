import hashlib,json,sqlite3,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import update_icons as sync

class MasterTests(unittest.TestCase):
 def test_named_columns_ignore_physical_order(self):
  with tempfile.NamedTemporaryFile() as f:
   with sqlite3.connect(f.name) as db:
    cols=list(reversed(list(sync.COLUMNS.values())))
    db.execute('CREATE TABLE "'+sync.TABLE+'" ('+','.join('"'+c+'" TEXT' for c in cols)+')')
    for i in range(300):
     unit=str(100101+i*100)
     db.execute('INSERT INTO "'+sync.TABLE+'" VALUES (?,?,?,?)',('2026/10/31 12:00:00','ひより','ヒヨリ' if i==0 else 'キャラ'+str(i),unit))
   names=sync.read_names(Path(f.name).read_bytes())
   self.assertEqual(names['1001']['name'],'ヒヨリ')
   self.assertEqual(names['1001']['unit_id'],'100101')
 def fake_get(self,url):
  if url.endswith('/commits/master'): return b'{"sha":"abc"}'
  if url.endswith('/version.json'): return b'{"JP":{"version":10071410}}'
  if 'raw.githubusercontent' in url: return ('version https://git-lfs.github.com/spec/v1\noid sha256:'+hashlib.sha256(b'data').hexdigest()+'\nsize 4\n').encode()
  return b'bad!'
 def test_rejects_rollback(self):
  with patch.object(sync,'get',self.fake_get),self.assertRaisesRegex(ValueError,'regressed'):
   sync.load_master({'version':'10071500'})
 def test_rejects_corrupt_database(self):
  with patch.object(sync,'get',self.fake_get),self.assertRaisesRegex(ValueError,'checksum'):
   sync.load_master({'version':'10071310'})
 def test_same_digest_reuses_complete_names(self):
  names={'1411':{'name':'アーモンドアイ','unit_id':'141101'}}
  with patch.object(sync,'get',self.fake_get):
   result=sync.load_master({'version':'10071410','database_sha256':hashlib.sha256(b'data').hexdigest(),'master_names':names})
  self.assertEqual(result[1],names)

if __name__=='__main__': unittest.main()
