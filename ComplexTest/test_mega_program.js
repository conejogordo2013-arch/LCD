const fs=require('fs');
const vmMod=require('vm');
const src=fs.readFileSync('app.js','utf8');
const sandbox={console,globalThis:{},window:{addEventListener:()=>{}},document:{getElementById:()=>null},localStorage:{_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=String(v)}},setInterval:()=>0,clearInterval:()=>{},Date};
sandbox.globalThis=sandbox;vmMod.createContext(sandbox);vmMod.runInContext(src,sandbox);
const {Parser,VM,VFS}=sandbox.window.LCD;
const code=fs.readFileSync('ComplexTest/mega_program.lcdl','utf8');
const logs=[];const ui={status:()=>{},row:()=>{},print:(x)=>logs.push(String(x))};
const m=new VM({ui,parser:new Parser(),fs:new VFS()});
m.load(code,'MEGA');
for(let i=0;i<4000;i++)m.step(20);
function eq(name,val){if(m.vars[name]!==val)throw new Error(`${name} expected ${val} got ${m.vars[name]}`)}
eq('A',29); eq('AL',5); eq('LAST',5); eq('OUT',777); eq('ABSN',7); eq('MN',2); eq('MX',9); eq('L',11); eq('SS','WORLD');
if(Math.abs(m.vars.S)>1e-9||Math.abs(m.vars.C-1)>1e-9||Math.abs(m.vars.T)>1e-9) throw new Error('trig');
if(m.state!=='IDLE') throw new Error('state '+m.state);
if(!logs.some(x=>x.includes('777'))) throw new Error('READ/WRITE print missing');
console.log('OK mega_program verified');
