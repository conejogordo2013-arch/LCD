const fs=require('fs');const vmMod=require('vm');
const src=fs.readFileSync('app.js','utf8');
const sandbox={console,globalThis:{},window:{addEventListener:()=>{}},document:{getElementById:()=>null},localStorage:{_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=String(v)}},setInterval:()=>0,clearInterval:()=>{},Date};
sandbox.globalThis=sandbox;vmMod.createContext(sandbox);vmMod.runInContext(src,sandbox);
const {Parser,VM,VFS}=sandbox.window.LCD;
const m=new VM({ui:{status:()=>{},row:()=>{},print:()=>{}},parser:new Parser(),fs:new VFS()});
m.load(`LET CH:STR='A'
LET CODE:NUM=ORD(CH)
LET HX:STR=HEX(CODE)
LET BN:STR=BIN(CODE)
LET C2:STR=CHR(CODE)
LET N1:NUM=UNHEX(HX)
LET N2:NUM=UNBIN(BN)
LET M:NUM = POW(2,5)
ADD M,FLOOR(2.9)
ADD M,CEIL(2.1)
ADD M,ROUND(2.6)
LET ARR:ARR = 0
APUSH ARR,10
APUSH ARR,20
REFI P,ARR,1
DEREF P,V
SETPTR P,99
DEREF P,V2
SET CODE = ORD('B') : SET HX = HEX(CODE) : SET BN = BIN(CODE)
STOP`);
for(let i=0;i<1500;i++)m.step(20);
function ok(c,msg){if(!c) throw new Error(msg)}
ok(m.vars.CODE===66,'code');ok(m.vars.HX==='42','hx');ok(m.vars.BN==='1000010','bn');ok(m.vars.C2==='A','chr');ok(m.vars.N1===65&&m.vars.N2===65,'unhex/unbin');ok(m.vars.M===40,'math');ok(m.vars.V===20&&m.vars.V2===99,'ptr');
console.log('OK encoding/advanced suite');
