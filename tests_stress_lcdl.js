const fs=require('fs');
const vmMod=require('vm');
const src=fs.readFileSync('app.js','utf8');
const sandbox={console,globalThis:{},window:{addEventListener:()=>{}},document:{getElementById:()=>null},localStorage:{_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=String(v)}},setInterval:()=>0,clearInterval:()=>{},Date};
sandbox.globalThis=sandbox;vmMod.createContext(sandbox);vmMod.runInContext(src,sandbox);
const {Parser,VM,VFS}=sandbox.window.LCD;
let pass=0,fail=0;function t(name,fn){try{fn();console.log('OK',name);pass++;}catch(e){console.log('ERR',name,e.message);fail++;}}

t('Parser labels',()=>{const p=new Parser().parse('@L\nLET A:NUM = 1\nGOTO @L');if(!('@L' in p.labels)) throw new Error('label');});
t('VM typed NUM ok',()=>{const m=new VM({ui:{status:()=>{},row:()=>{},print:()=>{}},parser:new Parser()});m.load('LET A:NUM = 1\nSET A = A + 3\nSTOP');m.step(20);if(m.vars.A!==4)throw new Error('A!=4')});
t('VM type mismatch fault',()=>{const m=new VM({ui:{status:()=>{},row:()=>{},print:()=>{}},parser:new Parser()});m.load("LET A:NUM = 'X'");m.step(5);if(m.state!=='FAULT')throw new Error('no fault')});
t('VFS dirs+atomic',()=>{const f=new VFS();const bad=f.writeAtomic('/bad/a','1');if(bad.ok)throw new Error('bad path');const ok=f.writeAtomic('/app/a.lcdl','PRINT 1');if(!ok.ok)throw new Error('write fail');const r=f.read('/app/a.lcdl');if(!r.ok)throw new Error('read fail');});
t('Watchdog trips',()=>{const m=new VM({ui:{status:()=>{},row:()=>{},print:()=>{}},parser:new Parser()});m.maxOpsTotal=60;m.load('LET A:NUM=0\n@L\nSET A = A + 1\nGOTO @L');for(let i=0;i<10;i++)m.step(20);if(m.state!=='FAULT')throw new Error('watchdog');});
t('FOR/NEXT loop',()=>{const m=new VM({ui:{status:()=>{},row:()=>{},print:()=>{}},parser:new Parser(),fs:new VFS()});m.load('LET S:NUM = 0\nFOR I = 1 TO 5 STEP 1\nSET S = S + I\nNEXT I\nSTOP');m.step(200);if(m.vars.S!==15)throw new Error('S!=15')});
t('WRITE/READ/TIME commands',()=>{const logs=[];const ui={status:()=>{},row:()=>{},print:(x)=>logs.push(String(x))};const f=new VFS();const m=new VM({ui,parser:new Parser(),fs:f});m.load("WRITE('K1',123)\nREAD('K1')\nTIME\nSTOP");m.step(100);if(!logs.some(x=>x.includes('123')))throw new Error('read missing');if(!logs.some(x=>/^\d+$/.test(x)))throw new Error('time missing');});


t('Preprocessor define/ifdef/include',()=>{const f=new VFS();f.writeAtomic('/app/inc.lcdl',"LET B:NUM = 2");const parser=new Parser(f);const m=new VM({ui:{status:()=>{},row:()=>{},print:()=>{}},parser,fs:f});m.load("@DEFINE FEAT 1\n@IFDEF FEAT\nLET A:NUM = 1\n@ENDIF\n@INCLUDE '/app/inc.lcdl'\nSET A = A + B\nSTOP");m.step(100);if(m.vars.A!==3)throw new Error('pp fail');});


t('Math ops + arrays',()=>{const m=new VM({ui:{status:()=>{},row:()=>{},print:()=>{}},parser:new Parser(),fs:new VFS()});m.load("LET A:NUM = 10\nADD A,5\nMUL A,2\nDIV A,3\nMOD A,4\nLET ARR:ARR = 0\nAPUSH ARR,'X'\nAPUSH ARR,'Y'\nALEN ARR,LN\nAGET ARR,1,OUT\nSTOP");m.step(300);if(m.vars.A!==2)throw new Error('math');if(m.vars.LN!==2)throw new Error('alen');if(m.vars.OUT!=='Y')throw new Error('aget');});


t('Include .lcdh header',()=>{const f=new VFS();f.writeAtomic('/app/h.lcdh',"LET K:NUM = 7");const parser=new Parser(f);const m=new VM({ui:{status:()=>{},row:()=>{},print:()=>{}},parser,fs:f});m.load("@INCLUDE '/app/h.lcdh'\nSET K = K + 1\nSTOP");m.step(50);if(m.vars.K!==8)throw new Error('lcdh include');});

console.log(`RESULT ${pass} passed ${fail} failed`);if(fail) process.exit(1);
