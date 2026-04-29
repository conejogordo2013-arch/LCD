const fs=require('fs');
const DB='jobs_versions.json';
const db=fs.existsSync(DB)?JSON.parse(fs.readFileSync(DB,'utf8')):{};
const [,,cmd,name,content]=process.argv;
if(cmd==='save'){db[name]=db[name]||[];db[name].push({ts:Date.now(),content:content||''});fs.writeFileSync(DB,JSON.stringify(db,null,2));console.log('saved',name,db[name].length)}
else if(cmd==='list'){console.log(Object.keys(db).join('\n'))}
else if(cmd==='show'){console.log(JSON.stringify(db[name]||[],null,2))}
else console.log('use: save <name> <content> | list | show <name>');
