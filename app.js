(()=>{
'use strict';
const W=32,H=12,FSKEY='lcd.fs.v9',JMAX=32;
const SEG={'0':'abcdef','1':'bc','2':'abdeg','3':'abcdg','4':'bcfg','5':'acdfg','6':'acdefg','7':'abc','8':'abcdefg','9':'abcdfg','A':'abcefg','B':'cdefg','C':'adef','D':'bcdeg','E':'adefg','F':'aefg','G':'acdef','H':'bcefg','I':'bc','J':'bcde','K':'efg','L':'def','M':'abcef','N':'abcef','O':'abcdef','P':'abefg','Q':'abcfg','R':'efg','S':'acdfg','T':'defg','U':'bcdef','V':'cde','W':'bcdef','X':'bcefg','Y':'bcdfg','Z':'abdeg','-':'g','_':'',' ':''};

class DisplayDriver{constructor(root){this.root=root;this.cells=[];this.buf=Array.from({length:H},()=>Array(W).fill('_'));this.cur={x:0,y:0};this.init();}
init(){const f=document.createDocumentFragment();for(let i=0;i<W*H;i++){const c=document.createElement('div');c.className='cell';const m={};for(const s of 'abcdefg'){const e=document.createElement('div');e.className='seg '+s;m[s]=e;c.appendChild(e)}this.cells.push(m);f.appendChild(c)}this.root.appendChild(f)}
id(x,y){return y*W+x}
put(x,y,ch){if(x<0||y<0||x>=W||y>=H)return;ch=(ch||'_').toUpperCase();if(this.buf[y][x]===ch)return;this.buf[y][x]=ch;const seg=SEG[ch]??'';const m=this.cells[this.id(x,y)];for(const s of 'abcdefg')m[s].classList.toggle('on',seg.includes(s));}
cls(){for(let y=0;y<H;y++)for(let x=0;x<W;x++)this.put(x,y,'_');this.cur={x:0,y:0}}
nl(){this.cur.x=0;this.cur.y++;if(this.cur.y>=H){for(let y=1;y<H;y++)for(let x=0;x<W;x++)this.put(x,y-1,this.buf[y][x]);for(let x=0;x<W;x++)this.put(x,H-1,'_');this.cur.y=H-1}}
print(txt){for(const ch of String(txt)){if(ch==='\n'){this.nl();continue}this.put(this.cur.x,this.cur.y,ch===' '?'_':ch);this.cur.x++;if(this.cur.x>=W)this.nl();}}
row(y,text){for(let x=0;x<W;x++)this.put(x,y,'_');for(let i=0;i<Math.min(W,text.length);i++)this.put(i,y,text[i]);}
}

class VFS{constructor(){this.db={files:{},meta:{},journal:[]};this.load();if(!Object.keys(this.db.files).length)this.seed();}
now(){return Date.now()} norm(path){return ('/'+path).replace(/\/+/g,'/').replace('//','/')}
crc16(s){let c=0;for(let i=0;i<s.length;i++)c=(c+s.charCodeAt(i))&0xffff;return c}
appendJournal(op,path,ok,extra=''){this.db.journal.push({t:this.now(),op,path,ok,extra});if(this.db.journal.length>JMAX)this.db.journal=this.db.journal.slice(-JMAX)}
seed(){this.writeAtomic('/sys/boot.lcdl',"PRINT 'LCD READY'\nPRINT 'TYPE HELP'",'SRC');this.writeAtomic('/app/watch.lcdl',"LET N:NUM = 0\n@L\nSHOW 1, 'CNT='+N\nSET N = N+1\nIF N>999 THEN @R\nSLEEP 200\nGOTO @L\n@R\nSET N = 0\nGOTO @L",'SRC')}
load(){try{const d=JSON.parse(localStorage.getItem(FSKEY)||'');if(d?.files&&d?.meta)this.db=d}catch{}}
save(){localStorage.setItem(FSKEY,JSON.stringify(this.db))}
read(path){path=this.norm(path);if(!(path in this.db.files)){this.appendJournal('READ',path,false,'EF404');return {ok:false,err:'EF404'}}this.appendJournal('READ',path,true);return {ok:true,data:this.db.files[path],meta:this.db.meta[path]}}
list(prefix='/'){prefix=this.norm(prefix);return Object.keys(this.db.files).filter(p=>p.startsWith(prefix)).sort()}
writeAtomic(path,data,type='SRC'){path=this.norm(path);const payload=String(data);const tmp=path+'.tmp';this.db.files[tmp]=payload;this.db.meta[tmp]={size:payload.length,mtime:this.now(),type:'TMP',crc:this.crc16(payload)};this.db.files[path]=this.db.files[tmp];this.db.meta[path]={size:payload.length,mtime:this.now(),type,crc:this.crc16(payload)};delete this.db.files[tmp];delete this.db.meta[tmp];this.appendJournal('WRITE',path,true);this.save();return {ok:true}}
del(path){path=this.norm(path);const ok=(path in this.db.files);delete this.db.files[path];delete this.db.meta[path];this.appendJournal('DEL',path,ok,ok?'':'EF404');this.save();return {ok}}
}

class Parser{parse(src){const out=[],labels={};const lines=String(src).split(/\r?\n/);for(let i=0;i<lines.length;i++){const raw=lines[i].trim();if(!raw||raw.startsWith('#'))continue;if(raw.startsWith('@')){labels[raw.toUpperCase()]=out.length;continue}out.push({line:i+1,raw})}return {ok:true,prog:out,labels}}}

class VM{constructor(io){this.io=io;this.resetAll()}
resetAll(){this.state='IDLE';this.vars={};this.stack=[];this.pc=0;this.labels={};this.prog=[];this.lastErr='';this.sleepUntil=0;this.maxOpsPerTick=40;this.maxDepth=8;this.maxOpsTotal=120000;this.opsTotal=0;this.trace=false;}
load(src){const p=this.io.parser.parse(src);this.prog=p.prog;this.labels=p.labels;this.pc=0;this.opsTotal=0;this.state='RUNNING';this.lastErr='';}
err(code,msg,line){this.lastErr=`${code} L${line} ${msg}`;this.state='FAULT';this.io.ui.status(this.lastErr)}
num(v){const n=Number(v);return Number.isFinite(n)?n:null}
resolveToken(tok){const t=tok.trim();if(/^'.*'$/.test(t))return t.slice(1,-1);if(/^[A-Z_][A-Z0-9_]*$/i.test(t)&&t.toUpperCase() in this.vars)return this.vars[t.toUpperCase()];const n=this.num(t);if(n!==null)return n;return t}
evalExpr(expr){expr=expr.trim();const add=expr.split('+').map(s=>s.trim());if(add.length>1){let acc=this.resolveToken(add[0]);for(let i=1;i<add.length;i++){const b=this.resolveToken(add[i]);acc=(typeof acc==='number'&&typeof b==='number')?acc+b:String(acc)+String(b)}return acc}return this.resolveToken(expr)}
jump(lbl,line){const k=lbl.toUpperCase();if(!(k in this.labels))return this.err('EP140',`LABEL ${lbl}`,line);this.pc=this.labels[k]}
test(cond){const m=cond.match(/^(.+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);if(!m)return false;const a=this.evalExpr(m[1]),b=this.evalExpr(m[3]);switch(m[2]){case '==':return a==b;case '!=':return a!=b;case '>':return a>b;case '<':return a<b;case '>=':return a>=b;case '<=':return a<=b}return false}
stepOne(){if(this.pc>=this.prog.length){this.state='IDLE';this.io.ui.status('DONE');return}const ins=this.prog[this.pc],t=ins.raw,u=t.toUpperCase();if(this.trace)this.io.ui.row(10,`PC=${String(this.pc).padStart(3,'0')} ${u.slice(0,20)}`);
if(u==='STOP'){this.state='IDLE';this.io.ui.status('IDLE');return}
if(u==='PAUSE'){this.state='PAUSED';this.io.ui.status('PAUSED');return}
if(u==='RESET'){this.resetAll();this.io.ui.status('RESET');return}
if(u.startsWith('LET ')){const m=t.match(/^LET\s+([A-Z_][A-Z0-9_]*)\s*:\s*(NUM|STR|BOOL|STATE)\s*=\s*(.+)$/i);if(!m)return this.err('EP101','LET',ins.line);const k=m[1].toUpperCase(),ty=m[2].toUpperCase();let v=this.evalExpr(m[3]);if(ty==='NUM'){const n=this.num(v);if(n===null)return this.err('ET200','NUM',ins.line);v=n}else if(ty==='BOOL')v=v?1:0;else v=String(v).toUpperCase();this.vars[k]=v;this.pc++;return}
if(u.startsWith('SET ')){const m=t.match(/^SET\s+([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$/i);if(!m)return this.err('EP102','SET',ins.line);this.vars[m[1].toUpperCase()]=this.evalExpr(m[2]);this.pc++;return}
if(u.startsWith('ADD ')){const[,k,v]=t.split(/\s+/);this.vars[k]=(Number(this.vars[k])||0)+(Number(this.evalExpr(v))||0);this.pc++;return}
if(u.startsWith('SUB ')){const[,k,v]=t.split(/\s+/);this.vars[k]=(Number(this.vars[k])||0)-(Number(this.evalExpr(v))||0);this.pc++;return}
if(u.startsWith('PRINT ')){this.io.ui.print(this.evalExpr(t.slice(6)));this.pc++;return}
if(u.startsWith('SHOW ')){const m=t.match(/^SHOW\s+(\d+)\s*,\s*(.+)$/i);if(!m)return this.err('EP103','SHOW',ins.line);this.io.ui.row(Math.min(11,Math.max(0,+m[1])),String(this.evalExpr(m[2])));this.pc++;return}
if(u.startsWith('IF ')){const m=t.match(/^IF\s+(.+)\s+THEN\s+(@[A-Z0-9_]+)$/i);if(!m)return this.err('EP104','IF',ins.line);if(this.test(m[1])){this.jump(m[2],ins.line);return}this.pc++;return}
if(u.startsWith('GOTO ')){this.jump(t.slice(5).trim(),ins.line);return}
if(u.startsWith('CALL ')){if(this.stack.length>=this.maxDepth)return this.err('ER301','STACK',ins.line);this.stack.push(this.pc+1);this.jump(t.slice(5).trim(),ins.line);return}
if(u==='RET'){if(!this.stack.length)return this.err('ER302','RET',ins.line);this.pc=this.stack.pop();return}
if(u.startsWith('SLEEP ')){this.sleepUntil=Date.now()+Math.max(0,Number(t.split(/\s+/)[1])||0);this.pc++;return}
if(u==='STATUS'){this.io.ui.status(`RUN PC=${this.pc} OPS=${this.opsTotal}`);this.pc++;return}
return this.err('EP199',`UNKNOWN ${t}`,ins.line)}
step(budget=this.maxOpsPerTick){if(this.state!=='RUNNING')return;if(Date.now()<this.sleepUntil)return;let n=0;while(this.state==='RUNNING'&&n<budget){this.stepOne();n++;this.opsTotal++;if(this.opsTotal>this.maxOpsTotal){this.err('ER399','WATCHDOG',this.prog[this.pc]?.line||0);break}if(Date.now()<this.sleepUntil)break}}
}

class Terminal{constructor(display,fs,vm){this.d=display;this.fs=fs;this.vm=vm;this.cli='';this.ev=[];this.lastKeyTs=0;this.bind();this.boot();}
status(t){this.d.row(11,String(t).slice(0,W).toUpperCase())}
row(y,t){this.d.row(y,String(t).toUpperCase())}
print(t){this.d.print(String(t).toUpperCase());this.d.nl()}
boot(){this.d.cls();this.status('IDLE');const b=this.fs.read('/sys/boot.lcdl');if(b.ok)this.runScript('/sys/boot.lcdl')}
runScript(path){const r=this.fs.read(path);if(!r.ok)return this.print('NOFILE');this.vm.load(r.data);this.status('RUN '+path.split('/').pop().toUpperCase())}
enqueue(ev){this.ev.push(ev);if(this.ev.length>64)this.ev.shift()}
processInput(){const ev=this.ev.shift();if(!ev)return;if(ev.type==='line'){this.cmd(ev.data)}}
cmd(c){const t=c.trim();if(!t)return;const u=t.toUpperCase();if(u==='HELP')return this.print('RUN LS CAT WRITE DEL STATUS STOP PAUSE CONT RESET TRACE STEP JLS');
if(u==='LS')return this.print(this.fs.list('/').slice(0,8).join(' '));
if(u==='JLS')return this.print(this.fs.db.journal.slice(-4).map(j=>j.op+':'+j.path).join(' '));
if(u.startsWith('CAT ')){const r=this.fs.read(u.slice(4).trim().toLowerCase());return this.print(r.ok?r.data.slice(0,80):'NOFILE')}
if(u.startsWith('RUN '))return this.runScript(u.slice(4).trim().toLowerCase());
if(u.startsWith('WRITE ')){const m=t.match(/^WRITE\s+(\S+)\s+(.+)$/i);if(!m)return this.print('E CMD');this.fs.writeAtomic(m[1].toLowerCase(),m[2]);return this.print('OK')}
if(u.startsWith('DEL ')){const r=this.fs.del(u.slice(4).trim().toLowerCase());return this.print(r.ok?'OK':'NOFILE')}
if(u==='STATUS')return this.print(`STATE=${this.vm.state} PC=${this.vm.pc} OPS=${this.vm.opsTotal}`);
if(u==='STOP'){this.vm.state='IDLE';return this.status('STOP')}
if(u==='PAUSE'){this.vm.state='PAUSED';return this.status('PAUSED')}
if(u==='CONT'){if(this.vm.state==='PAUSED')this.vm.state='RUNNING';return this.status(this.vm.state)}
if(u==='RESET'){this.vm.resetAll();return this.status('RESET')}
if(u==='TRACE'){this.vm.trace=!this.vm.trace;return this.print('TRACE '+(this.vm.trace?'ON':'OFF'))}
if(u==='STEP'){if(this.vm.state==='PAUSED'||this.vm.state==='IDLE'){if(this.vm.state==='IDLE'&&this.vm.prog.length===0)return this.print('NOPROG');this.vm.state='RUNNING';this.vm.step(1);if(this.vm.state==='RUNNING')this.vm.state='PAUSED';return this.status('STEP')}return this.print('BUSY')}
this.vm.load(t)}
bind(){window.addEventListener('keydown',e=>{const now=Date.now();if(now-this.lastKeyTs<20)return;this.lastKeyTs=now;if(e.key==='Enter'){this.d.nl();this.enqueue({type:'line',data:this.cli});this.cli='';return}if(e.key==='Backspace'){this.cli=this.cli.slice(0,-1);return}if(e.key.length===1){this.cli+=e.key;this.d.print(e.key.toUpperCase())}})}
}

const display=new DisplayDriver(document.getElementById('grid'));
const fs=new VFS();
const parser=new Parser();
const uiStub={};
const vm=new VM({ui:uiStub,parser});
const term=new Terminal(display,fs,vm);
uiStub.print=t=>term.print(t);uiStub.row=(y,t)=>term.row(y,t);uiStub.status=t=>term.status(t);
setInterval(()=>{term.processInput();vm.step();},20);
})();
