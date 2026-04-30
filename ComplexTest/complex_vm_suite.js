const fs=require('fs');
const vmMod=require('vm');
const src=fs.readFileSync('app.js','utf8');
const sandbox={console,globalThis:{},window:{addEventListener:()=>{}},document:{getElementById:()=>null},localStorage:{_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=String(v)}},setInterval:()=>0,clearInterval:()=>{},Date};
sandbox.globalThis=sandbox;vmMod.createContext(sandbox);vmMod.runInContext(src,sandbox);
const {Parser,VM,VFS}=sandbox.window.LCD;
const ui={status:()=>{},row:()=>{},print:()=>{}};
let pass=0,fail=0;
function t(name,fn){try{fn();console.log('OK',name);pass++;}catch(e){console.log('ERR',name,e.message);fail++;}}

// 1) Large expression + trig + strings pipeline
t('expr+func large pipeline',()=>{
  const m=new VM({ui,parser:new Parser(),fs:new VFS()});
  m.load(`LET A:NUM = 0
SET A = 2 + 3*4 + 10/2
LET S:NUM = SIN(0)
LET C:NUM = COS(0)
LET T:NUM = TAN(0)
LET TXT:STR = UPPER('abc')
LET L:NUM = LEN(TXT)
LET SB:STR = SUBSTR('HELLOWORLD',2,4)
STOP`);
  m.step(400);
  if(m.vars.A!==19) throw new Error('A');
  if(Math.abs(m.vars.S)>1e-9||Math.abs(m.vars.C-1)>1e-9||Math.abs(m.vars.T)>1e-9) throw new Error('trig');
  if(m.vars.TXT!=='ABC'||m.vars.L!==3||m.vars.SB!=='LLOW') throw new Error('str');
});

// 2) Deep control flow + pointers + arrays
t('control+ptr+array',()=>{
  const m=new VM({ui,parser:new Parser(),fs:new VFS()});
  m.load(`LET SUM:NUM = 0
LET I:NUM = 0
LET ARR:ARR = 0
@L
ADD I,1
ADD SUM,I
APUSH ARR,I
IF I < 40 THEN @L
REF P,SUM
SETPTR P,99
DEREF P,OUT
ALEN ARR,AL
AGET ARR,39,LAST
STOP`);
  m.step(3000);
  if(m.vars.SUM!==99) throw new Error('ptr');
  if(m.vars.OUT!==99) throw new Error('deref');
  if(m.vars.AL!==40||m.vars.LAST!==40) throw new Error('array');
});

// 3) VFS stress writes/reads
t('vfs heavy journal writes',()=>{
  const f=new VFS();
  for(let i=0;i<120;i++){
    const r=f.writeAtomic(`/var/k${i}`,`VAL-${i}`,'CFG');
    if(!r.ok) throw new Error('write '+i);
  }
  for(let i=0;i<120;i++){
    const r=f.read(`/var/k${i}`);
    if(!r.ok||r.data!==`VAL-${i}`) throw new Error('read '+i);
  }
  if(f.db.journal.length>64) throw new Error('journal cap');
});

console.log(`RESULT ${pass} passed ${fail} failed`);
if(fail) process.exit(1);
