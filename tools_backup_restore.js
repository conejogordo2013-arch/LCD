const fs=require('fs');
const STORE='lcd_backup.json';
if(process.argv[2]==='backup'){const data=process.argv[3]||'{}';fs.writeFileSync(STORE,data);console.log('backup ok',STORE)}
else if(process.argv[2]==='restore'){if(!fs.existsSync(STORE))throw new Error('no backup');console.log(fs.readFileSync(STORE,'utf8'))}
else console.log('use: node tools_backup_restore.js backup <json> | restore');
