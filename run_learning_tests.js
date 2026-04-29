const fs=require('fs');
const vmMod=require('vm');
const src=fs.readFileSync('app.js','utf8');
const sandbox={console,globalThis:{},window:{addEventListener:()=>{}},document:{getElementById:()=>null},localStorage:{_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=String(v)}},setInterval:()=>0,clearInterval:()=>{},Date};
sandbox.globalThis=sandbox;vmMod.createContext(sandbox);vmMod.runInContext(src,sandbox);
const {Parser,VM,VFS}=sandbox.window.LCD;
const uiLogs=[];const ui={status:()=>{},row:()=>{},print:(x)=>uiLogs.push(String(x))};
const parser=new Parser();
const files=['learning/01_basico.lcdl','learning/02_control_flujo.lcdl','learning/03_archivos_y_arrays.lcdl'];
let fail=0;
for(const f of files){
  const code=fs.readFileSync(f,'utf8');
  const m=new VM({ui,parser,fs:new VFS()});
  m.load(code); for(let i=0;i<400;i++) m.step(20);
  if(m.state==='FAULT'){console.log('ERR',f,m.lastErr);fail++;} else console.log('OK',f,m.state);
}
console.log('PRINT_LOGS',uiLogs.slice(-5).join(' | '));
if(fail) process.exit(1);
