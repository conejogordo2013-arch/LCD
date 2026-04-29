const fs=require('fs');
const vmMod=require('vm');
const src=fs.readFileSync('app.js','utf8');
const sandbox={console,globalThis:{},window:{addEventListener:()=>{}},document:{getElementById:()=>null},localStorage:{_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=String(v)}},setInterval:()=>0,clearInterval:()=>{},Date};
sandbox.globalThis=sandbox;vmMod.createContext(sandbox);vmMod.runInContext(src,sandbox);
const {Parser,VM,VFS}=sandbox.window.LCD;

let pass=0,fail=0;const uiNoop={status:()=>{},row:()=>{},print:()=>{}};
function t(name,fn){try{fn();console.log('OK',name);pass++;}catch(e){console.log('ERR',name,e.message);fail++;}}
function mkVM(fsInst){return new VM({ui:uiNoop,parser:new Parser(),fs:fsInst||new VFS()});}

t('State transitions via signal()',()=>{const m=mkVM();m.load("LET A:NUM = 1");if(m.state!=='RUNNING')throw new Error('not running');m.signal('PAUSE');if(m.state!=='PAUSED')throw new Error('pause');m.signal('CONT');if(m.state!=='RUNNING')throw new Error('cont');m.signal('STOP');if(m.state!=='IDLE')throw new Error('stop');});

t('run(programId) loads from FS',()=>{const f=new VFS();f.writeAtomic('/app/t1.lcdl',"LET A:NUM = 9\nSTOP");const m=mkVM(f);if(!m.run('/app/t1.lcdl','T1'))throw new Error('run false');m.step(50);if(m.vars.A!==9)throw new Error('A');});

t('Quota max files honored',()=>{const f=new VFS();let i=0,lastOk=true;for(i=0;i<140;i++){const r=f.writeAtomic(`/app/f${i}.lcdl`,'X');if(!r.ok){lastOk=false;break;}}if(lastOk)throw new Error('quota not hit');});

t('Random arithmetic programs stay deterministic',()=>{for(let k=0;k<60;k++){const target=Math.floor(Math.random()*50)+1;const prog=["LET A:NUM = 0"];for(let i=0;i<target;i++)prog.push("SET A = A + 1");prog.push('STOP');const m=mkVM();m.load(prog.join('\n'));m.step(3000);if(m.vars.A!==target)throw new Error(`det mismatch ${target} vs ${m.vars.A}`);}});

t('Nested CALL/RET works within depth',()=>{const m=mkVM();m.maxDepth=8;m.load("LET A:NUM = 0\nCALL @L1\nSTOP\n@L1\nSET A = A + 1\nCALL @L2\nRET\n@L2\nSET A = A + 2\nRET");m.step(200);if(m.vars.A!==3)throw new Error('A!=3');});

t('Invalid transitions blocked',()=>{const m=mkVM();if(m.signal('CONT')!==false)throw new Error('should reject CONT from IDLE');});


t('Journal recovery removes temp artifacts',()=>{const f=new VFS();f.db.files['/app/x.tmp']='123';f.db.meta['/app/x.tmp']={};f.db.journal.push({op:'WRITE_BEGIN',path:'/app/x'});f.recoverJournal();if('/app/x.tmp' in f.db.files)throw new Error('tmp not recovered');});

console.log(`RESULT intensive ${pass} passed ${fail} failed`);
if(fail) process.exit(1);
