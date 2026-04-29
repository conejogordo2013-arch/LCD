(()=>{'use strict';
const W=32,H=12,FSKEY='lcd.fs.v10',JMAX=64,MAX_FILE_SIZE=4096,MAX_FILES=128;
const SEG={'0':'abcdef','1':'bc','2':'abdeg','3':'abcdg','4':'bcfg','5':'acdfg','6':'acdefg','7':'abc','8':'abcdefg','9':'abcdfg','A':'abcefg','B':'cdefg','C':'adef','D':'bcdeg','E':'adefg','F':'aefg','G':'acdef','H':'bcefg','I':'bc','J':'bcde','K':'efg','L':'def','M':'abcef','N':'abcef','O':'abcdef','P':'abefg','Q':'abcfg','R':'efg','S':'acdfg','T':'defg','U':'bcdef','V':'cde','W':'bcdef','X':'bcefg','Y':'bcdfg','Z':'abdeg','-':'g','_':'',' ':''};
const SYS={DIRS:['/sys','/app','/var','/tmp'],STATE:['OK','WARN','ERR','BOOT','SYNC','DISC']};
class DisplayDriver{constructor(root){this.root=root;this.cells=[];this.buf=Array.from({length:H},()=>Array(W).fill('_'));this.cur={x:0,y:0};this.init();}
init(){const f=document.createDocumentFragment();for(let i=0;i<W*H;i++){const c=document.createElement('div');c.className='cell';const m={};for(const s of 'abcdefg'){const e=document.createElement('div');e.className='seg '+s;m[s]=e;c.appendChild(e)}this.cells.push(m);f.appendChild(c)}this.root.appendChild(f)}
id(x,y){return y*W+x}
put(x,y,ch){if(x<0||y<0||x>=W||y>=H)return;ch=(ch||'_').toUpperCase();if(this.buf[y][x]===ch)return;this.buf[y][x]=ch;const seg=SEG[ch]??'';const m=this.cells[this.id(x,y)];for(const s of 'abcdefg')m[s].classList.toggle('on',seg.includes(s));}
cls(){for(let y=0;y<H;y++)for(let x=0;x<W;x++)this.put(x,y,'_');this.cur={x:0,y:0}}
nl(){this.cur.x=0;this.cur.y++;if(this.cur.y>=H){for(let y=1;y<H;y++)for(let x=0;x<W;x++)this.put(x,y-1,this.buf[y][x]);for(let x=0;x<W;x++)this.put(x,H-1,'_');this.cur.y=H-1}}
print(txt){for(const ch of String(txt)){if(ch==='\n'){this.nl();continue}this.put(this.cur.x,this.cur.y,ch===' '?'_':ch);this.cur.x++;if(this.cur.x>=W)this.nl();}}
row(y,text){for(let x=0;x<W;x++)this.put(x,y,'_');for(let i=0;i<Math.min(W,text.length);i++)this.put(i,y,text[i]);}}
class VFS{constructor(){this.db={files:{},meta:{},journal:[]};this.load();if(!Object.keys(this.db.files).length)this.seed();}
now(){return Date.now()} norm(path){let p=(''+path).trim().toLowerCase();if(!p.startsWith('/'))p='/'+p;return p.replace(/\/+/g,'/').replace(/\/\/+$/,'')||'/';}
crc16(s){let c=0;for(let i=0;i<s.length;i++)c=(c+s.charCodeAt(i))&0xffff;return c}
appendJournal(op,path,ok,extra=''){this.db.journal.push({t:this.now(),op,path,ok,extra});if(this.db.journal.length>JMAX)this.db.journal=this.db.journal.slice(-JMAX)}
ensurePath(path){if(!SYS.DIRS.some(d=>path===d||path.startsWith(d+'/')))return {ok:false,err:'EF410'};return {ok:true}}
load(){try{const d=JSON.parse(localStorage.getItem(FSKEY)||'');if(d?.files&&d?.meta)this.db=d}catch{}this.recoverJournal()}
recoverJournal(){const j=this.db.journal||[];for(const e of j.slice(-JMAX)){if(e.op==='WRITE_BEGIN'&&e.path){delete this.db.files[e.path+'.tmp'];delete this.db.meta[e.path+'.tmp']}if(e.op==='WRITE_ROLLBACK'&&e.path){delete this.db.files[e.path];delete this.db.meta[e.path]}}this.save()}
save(){localStorage.setItem(FSKEY,JSON.stringify(this.db))}
seed(){this.writeAtomic('/sys/core.lcdh',"@DEFINE CORE 1\nLET UPT:NUM = 0",'SRC',['RO']);this.writeAtomic('/sys/boot.lcdl',"PRINT 'LCD READY'\nPRINT 'TYPE HELP'\nSHOW 0,'MODE=BOOT'",'SRC',['RO']);this.writeAtomic('/app/watch.lcdl',"LET TMP:NUM = 65\nLET FAN:STATE = 'OK'\n@LOOP\nSHOW 0,'MODE=RUN'\nSHOW 1,'TMP='+TMP\nSHOW 2,'FAN='+FAN\nIF TMP>80 THEN @HOT\nSET TMP = TMP + 1\nSLEEP 150\nGOTO @LOOP\n@HOT\nSET FAN = 'WARN'\nSHOW 9,'ALM=OVHT'\nSLEEP 400\nSET TMP = 65\nSET FAN = 'OK'\nGOTO @LOOP",'SRC');}
read(path){path=this.norm(path);if(!(path in this.db.files)){this.appendJournal('READ',path,false,'EF404');return {ok:false,err:'EF404'}}this.appendJournal('READ',path,true);return {ok:true,data:this.db.files[path],meta:this.db.meta[path]}}
list(prefix='/'){prefix=this.norm(prefix);return Object.keys(this.db.files).filter(p=>p.startsWith(prefix)).sort()}
writeAtomic(path,data,type='SRC',flags=[]){path=this.norm(path);const pchk=this.ensurePath(path);if(!pchk.ok){this.appendJournal('WRITE',path,false,pchk.err);return pchk}if(path.startsWith('/sys/')&&!flags.includes('RO_OVERRIDE')){const ex=this.db.meta[path];if(ex?.flags?.includes('RO'))return {ok:false,err:'EF403'}}
const payload=String(data);if(payload.length>MAX_FILE_SIZE)return {ok:false,err:'EF413'};if(!(path in this.db.files)&&Object.keys(this.db.files).length>=MAX_FILES)return {ok:false,err:'EF429'};
const tmp=path+'.tmp';this.appendJournal('WRITE_BEGIN',path,true);this.db.files[tmp]=payload;this.db.meta[tmp]={size:payload.length,mtime:this.now(),type:'TMP',crc:this.crc16(payload),flags};
this.db.files[path]=this.db.files[tmp];this.db.meta[path]={size:payload.length,mtime:this.now(),type,crc:this.crc16(payload),flags};
delete this.db.files[tmp];delete this.db.meta[tmp];this.appendJournal('WRITE_COMMIT',path,true);this.appendJournal('WRITE',path,true);this.save();return {ok:true}}
del(path){path=this.norm(path);if(path.startsWith('/sys/'))return {ok:false,err:'EF403'};const ok=(path in this.db.files);delete this.db.files[path];delete this.db.meta[path];this.appendJournal('DEL',path,ok,ok?'':'EF404');this.save();return {ok}}}
class Parser{constructor(fs=null){this.fs=fs} tokenize(line){const re=/'[^']*'|@[A-Z_][A-Z0-9_]*|[A-Z_][A-Z0-9_]*|\d+|==|!=|>=|<=|[(),:+\-*/%<>]/gi;return (line.match(re)||[]).map(t=>t.toUpperCase())} preprocess(src,defs={}){const lines=String(src).split(/\r?\n/);const out=[];const st=[];for(let i=0;i<lines.length;i++){let raw=lines[i].trim();if(!raw)continue;let m;if((m=raw.match(/^@DEFINE\s+([A-Z_][A-Z0-9_]*)\s*(.*)$/i))){defs[m[1].toUpperCase()]=m[2]||'1';continue}if((m=raw.match(/^@IFDEF\s+([A-Z_][A-Z0-9_]*)$/i))){st.push(Boolean(defs[m[1].toUpperCase()]));continue}if((m=raw.match(/^@(IFNDEF|NODEF)\s+([A-Z_][A-Z0-9_]*)$/i))){st.push(!defs[m[2].toUpperCase()]);continue}if(/^@ENDIF$/i.test(raw)){st.pop();continue}if(st.includes(false))continue;if((m=raw.match(/^@INCLUDE\s+'([^']+)'$/i))&&this.fs){const inc=m[1].toLowerCase();if(!(inc.endsWith('.lcdl')||inc.endsWith('.lcdh')))continue;const r=this.fs.read(inc);if(r.ok)out.push(this.preprocess(r.data,defs));continue}out.push(raw)}return out.join('\n')} parse(src){const out=[],labels={};const pre=this.preprocess(src);const lines=String(pre).split(/\r?\n/);for(let i=0;i<lines.length;i++){const raw=lines[i].trim();if(!raw||raw.startsWith('#'))continue;if(raw.startsWith('@')){labels[raw.toUpperCase()]=out.length;continue}out.push({line:i+1,raw,tokens:this.tokenize(raw)})}return {ok:true,prog:out,labels}}}
class VM{constructor(io){this.io=io;this.resetAll()}
resetAll(){this.state='IDLE';this.vars={};this.types={};this.stack=[];this.forStack=[];this.pc=0;this.labels={};this.prog=[];this.lastErr='';this.sleepUntil=0;this.maxOpsPerTick=40;this.maxDepth=8;this.maxOpsTotal=120000;this.opsTotal=0;this.trace=false;this.entry='';}
setState(s){const ok={IDLE:['LOADING'],LOADING:['RUNNING','FAULT'],RUNNING:['PAUSED','STOPPING','FAULT','IDLE'],PAUSED:['RUNNING','STOPPING','FAULT'],STOPPING:['IDLE'],FAULT:['IDLE','LOADING']};if(this.state===s||!ok[this.state]||ok[this.state].includes(s)){this.state=s;this.io.ui.status(s==='RUNNING'?`RUN ${this.entry}`:s);return true}return false}
load(src,entry='SCRIPT'){this.setState('LOADING');const p=this.io.parser.parse(src);this.prog=p.prog;this.labels=p.labels;this.pc=0;this.opsTotal=0;this.lastErr='';this.entry=entry;this.setState('RUNNING');}
run(programId,entryLabel='SCRIPT'){const r=this.io.fs?this.io.fs.read(programId):{ok:false,err:'EF404'};if(!r.ok){this.err('EF400',r.err||'NOFILE',0);return false}this.load(r.data,entryLabel||programId.toUpperCase());return true}
signal(sig){const u=String(sig||'').toUpperCase();if(u==='STOP'){this.setState('STOPPING');this.setState('IDLE');return true}if(u==='PAUSE'){return this.setState('PAUSED')}if(u==='RESET'){this.resetAll();return true}if(u==='CONT'){return this.setState('RUNNING')}return false}
err(code,msg,line){this.lastErr=`${code} L${line} ${msg}`;this.state='FAULT';this.io.ui.status(this.lastErr)}
num(v){const n=Number(v);return Number.isFinite(n)?n:null}
resolveToken(tok){const t=tok.trim();if(/^'.*'$/.test(t))return t.slice(1,-1).toUpperCase();if(/^[A-Z_][A-Z0-9_]*$/i.test(t)&&t.toUpperCase() in this.vars)return this.vars[t.toUpperCase()];const n=this.num(t);if(n!==null)return n;return t.toUpperCase()}
castToType(type,val,line){if(type==='NUM'){const n=this.num(val);if(n===null)return this.err('ET200','NUM',line),null;return n}if(type==='ARR'){if(Array.isArray(val))return val;return []}if(type==='BOOL')return val?1:0;if(type==='STATE'){const s=String(val).toUpperCase();if(!SYS.STATE.includes(s))return this.err('ET201','STATE',line),null;return s}return String(val).toUpperCase()}
evalExpr(expr){expr=expr.trim();const add=expr.split('+').map(s=>s.trim());if(add.length>1){let acc=this.resolveToken(add[0]);for(let i=1;i<add.length;i++){const b=this.resolveToken(add[i]);if(typeof acc==='number'&&typeof b==='number')acc+=b;else acc=String(acc)+String(b)}return acc}return this.resolveToken(expr)}
jump(lbl,line){const k=lbl.toUpperCase();if(!(k in this.labels))return this.err('EP140',`LABEL ${lbl}`,line);this.pc=this.labels[k]}
test(cond,line){const m=cond.match(/^(.+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);if(!m)return this.err('EP105','COND',line),false;const a=this.evalExpr(m[1]),b=this.evalExpr(m[3]);if(typeof a!==typeof b&&['>','<','>=','<='].includes(m[2]))return this.err('ET202','CMP',line),false;switch(m[2]){case '==':return a===b;case '!=':return a!==b;case '>':return a>b;case '<':return a<b;case '>=':return a>=b;case '<=':return a<=b}return false}
stepOne(){if(this.pc>=this.prog.length){this.state='IDLE';this.io.ui.status('DONE');return}const ins=this.prog[this.pc],t=ins.raw,u=t.toUpperCase();if(this.trace)this.io.ui.row(10,`PC=${String(this.pc).padStart(3,'0')} ${u.slice(0,20)}`);
if(u==='STOP'){this.state='STOPPING';this.io.ui.status('STOPPING');this.state='IDLE';this.io.ui.status('IDLE');return}
if(u==='PAUSE'){this.state='PAUSED';this.io.ui.status('PAUSED');return}
if(u==='RESET'){this.resetAll();this.io.ui.status('RESET');return}
if(u.startsWith('LET ')){const m=t.match(/^LET\s+([A-Z_][A-Z0-9_]*)\s*:\s*(NUM|STR|BOOL|STATE|ARR)\s*=\s*(.+)$/i);if(!m)return this.err('EP101','LET',ins.line);const k=m[1].toUpperCase(),ty=m[2].toUpperCase();const v=this.castToType(ty,this.evalExpr(m[3]),ins.line);if(this.state==='FAULT')return;this.types[k]=ty;this.vars[k]=v;this.pc++;return}
if(u.startsWith('SET ')){const m=t.match(/^SET\s+([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$/i);if(!m)return this.err('EP102','SET',ins.line);const k=m[1].toUpperCase();const ty=this.types[k]||'STR';const v=this.castToType(ty,this.evalExpr(m[2]),ins.line);if(this.state==='FAULT')return;this.vars[k]=v;this.pc++;return}
if(u.startsWith('PRINT ')){this.io.ui.print(this.evalExpr(t.slice(6)));this.pc++;return}
if(u.startsWith('SHOW ')){const m=t.match(/^SHOW\s+(\d+)\s*,\s*(.+)$/i);if(!m)return this.err('EP103','SHOW',ins.line);this.io.ui.row(Math.min(11,Math.max(0,+m[1])),String(this.evalExpr(m[2])));this.pc++;return}
if(u.startsWith('IF ')){const m=t.match(/^IF\s+(.+)\s+THEN\s+(@[A-Z0-9_]+)$/i);if(!m)return this.err('EP104','IF',ins.line);if(this.test(m[1],ins.line)){this.jump(m[2],ins.line);return}this.pc++;return}
if(u.startsWith('GOTO ')){this.jump(t.slice(5).trim(),ins.line);return}
if(u.startsWith('CALL ')){if(this.stack.length>=this.maxDepth)return this.err('ER301','STACK',ins.line);this.stack.push(this.pc+1);this.jump(t.slice(5).trim(),ins.line);return}
if(u==='RET'){if(!this.stack.length)return this.err('ER302','RET',ins.line);this.pc=this.stack.pop();return}
if(u.startsWith('SLEEP ')){this.sleepUntil=Date.now()+Math.max(0,Number(t.split(/\s+/)[1])||0);this.pc++;return}
if(u==='STATUS'){this.io.ui.status(`RUN PC=${this.pc} OPS=${this.opsTotal}`);this.pc++;return}
if(u.startsWith('FOR ')){const m=t.match(/^FOR\s+([A-Z_][A-Z0-9_]*)\s*=\s*(.+)\s+TO\s+(.+?)(?:\s+STEP\s+(.+))?$/i);if(!m)return this.err('EP106','FOR',ins.line);const k=m[1].toUpperCase();const a=this.num(this.evalExpr(m[2]));const b=this.num(this.evalExpr(m[3]));const st=this.num(m[4]?this.evalExpr(m[4]):1);if(a===null||b===null||st===null||st===0)return this.err('ET203','FORNUM',ins.line);this.types[k]=this.types[k]||'NUM';this.vars[k]=a;this.forStack.push({k,end:b,step:st,pc:this.pc+1});this.pc++;return}
if(u.startsWith('NEXT ')){const k=t.slice(5).trim().toUpperCase();const fr=this.forStack[this.forStack.length-1];if(!fr||fr.k!==k)return this.err('ER303','NEXT',ins.line);this.vars[k]=this.num(this.vars[k])+fr.step;const v=this.vars[k];if((fr.step>0&&v<=fr.end)||(fr.step<0&&v>=fr.end)){this.pc=fr.pc;return}this.forStack.pop();this.pc++;return}
if(u.startsWith('READ(')){const m=t.match(/^READ\('([^']+)'\)$/i);if(!m)return this.err('EP107','READ',ins.line);const rr=this.io.fs?this.io.fs.read('/var/'+m[1].toLowerCase()):{ok:false};this.io.ui.print(rr.ok?rr.data:'EF404');this.pc++;return}
if(u.startsWith('WRITE(')){const m=t.match(/^WRITE\('([^']+)'\s*,\s*(.+)\)$/i);if(!m)return this.err('EP108','WRITE',ins.line);if(this.io.fs)this.io.fs.writeAtomic('/var/'+m[1].toLowerCase(),String(this.evalExpr(m[2])),'CFG');this.pc++;return}
if(u==='TIME'){this.io.ui.print(String(Date.now()));this.pc++;return}
if(u.startsWith('BEEP ')){this.pc++;return}


if(u.startsWith('ADD ')){const m=t.match(/^ADD\s+([A-Z_][A-Z0-9_]*)\s*,\s*(.+)$/i);if(!m)return this.err('EP109','ADD',ins.line);const k=m[1].toUpperCase();this.vars[k]=(this.num(this.vars[k])||0)+(this.num(this.evalExpr(m[2]))||0);this.types[k]='NUM';this.pc++;return}
if(u.startsWith('SUB ')){const m=t.match(/^SUB\s+([A-Z_][A-Z0-9_]*)\s*,\s*(.+)$/i);if(!m)return this.err('EP110','SUB',ins.line);const k=m[1].toUpperCase();this.vars[k]=(this.num(this.vars[k])||0)-(this.num(this.evalExpr(m[2]))||0);this.types[k]='NUM';this.pc++;return}
if(u.startsWith('MUL ')){const m=t.match(/^MUL\s+([A-Z_][A-Z0-9_]*)\s*,\s*(.+)$/i);if(!m)return this.err('EP111','MUL',ins.line);const k=m[1].toUpperCase();this.vars[k]=(this.num(this.vars[k])||0)*(this.num(this.evalExpr(m[2]))||0);this.types[k]='NUM';this.pc++;return}
if(u.startsWith('DIV ')){const m=t.match(/^DIV\s+([A-Z_][A-Z0-9_]*)\s*,\s*(.+)$/i);if(!m)return this.err('EP112','DIV',ins.line);const k=m[1].toUpperCase(),d=(this.num(this.evalExpr(m[2]))||0);if(d===0)return this.err('ER300','DIV0',ins.line);this.vars[k]=Math.trunc((this.num(this.vars[k])||0)/d);this.types[k]='NUM';this.pc++;return}
if(u.startsWith('MOD ')){const m=t.match(/^MOD\s+([A-Z_][A-Z0-9_]*)\s*,\s*(.+)$/i);if(!m)return this.err('EP113','MOD',ins.line);const k=m[1].toUpperCase(),d=(this.num(this.evalExpr(m[2]))||0);if(d===0)return this.err('ER300','MOD0',ins.line);this.vars[k]=(this.num(this.vars[k])||0)%d;this.types[k]='NUM';this.pc++;return}
if(u.startsWith('APUSH ')){const m=t.match(/^APUSH\s+([A-Z_][A-Z0-9_]*)\s*,\s*(.+)$/i);if(!m)return this.err('EP114','APUSH',ins.line);const k=m[1].toUpperCase();if(!Array.isArray(this.vars[k]))this.vars[k]=[];this.vars[k].push(this.evalExpr(m[2]));this.types[k]='ARR';this.pc++;return}
if(u.startsWith('ALEN ')){const m=t.match(/^ALEN\s+([A-Z_][A-Z0-9_]*)\s*,\s*([A-Z_][A-Z0-9_]*)$/i);if(!m)return this.err('EP115','ALEN',ins.line);const a=m[1].toUpperCase(),o=m[2].toUpperCase();this.vars[o]=(Array.isArray(this.vars[a])?this.vars[a].length:0);this.types[o]='NUM';this.pc++;return}
if(u.startsWith('AGET ')){const m=t.match(/^AGET\s+([A-Z_][A-Z0-9_]*)\s*,\s*(.+)\s*,\s*([A-Z_][A-Z0-9_]*)$/i);if(!m)return this.err('EP116','AGET',ins.line);const a=m[1].toUpperCase(),idx=this.num(this.evalExpr(m[2]))||0,o=m[3].toUpperCase();const arr=Array.isArray(this.vars[a])?this.vars[a]:[];this.vars[o]=arr[idx]??'';this.types[o]=typeof this.vars[o]==='number'?'NUM':'STR';this.pc++;return}

return this.err('EP199',`UNKNOWN ${t}`,ins.line)}
step(budget=this.maxOpsPerTick){if(this.state!=='RUNNING')return;if(Date.now()<this.sleepUntil)return;let n=0;while(this.state==='RUNNING'&&n<budget){this.stepOne();n++;this.opsTotal++;if(this.opsTotal>this.maxOpsTotal){this.err('ER399','WATCHDOG',this.prog[this.pc]?.line||0);break}if(Date.now()<this.sleepUntil)break}}}
class Terminal{constructor(display,fs,vm){this.d=display;this.fs=fs;this.vm=vm;this.cli='';this.ev=[];this.lastKeyTs=0;this.cursorOn=true;this.cursorTimer=null;this.bind();this.boot();this.startCursor();}
startCursor(){if(this.cursorTimer)clearInterval(this.cursorTimer);this.cursorTimer=setInterval(()=>{this.cursorOn=!this.cursorOn;this.renderCli();},350)}
renderCli(){const max=W-1;const view=this.cli.length>max?this.cli.slice(this.cli.length-max):this.cli;const line=(view+(this.cursorOn?'_':' ')).slice(0,W);this.row(10,line)}
acceptChar(ch){if(!ch)return;const c=String(ch).toUpperCase();if(c<' '||c>'~')return;this.cli+=c;this.renderCli()}
backspace(){if(!this.cli.length)return;this.cli=this.cli.slice(0,-1);this.renderCli()}
submitLine(){this.enqueue({type:'line',data:this.cli});this.cli='';this.renderCli()}
handleKey(e){const k=e.key||'';if(k==='Enter'){this.submitLine();return true}if(k==='Backspace'){this.backspace();return true}if(k==='Delete'){this.cli='';this.renderCli();return true}if(k==='Escape'){this.cli='';this.renderCli();return true}if(k==='Tab'){this.acceptChar(' ');this.acceptChar(' ');return true}if(k.length===1){this.acceptChar(k);return true}return false}
status(t){this.d.row(11,String(t).slice(0,W).toUpperCase())}
row(y,t){this.d.row(y,String(t).toUpperCase())}
print(t){this.d.print(String(t).toUpperCase());this.d.nl()}
boot(){this.d.cls();this.row(0,'MODE=BOOT');this.status('IDLE');this.renderCli();const b=this.fs.read('/sys/boot.lcdl');if(b.ok)this.runScript('/sys/boot.lcdl')}
runScript(path){const r=this.fs.read(path);if(!r.ok)return this.print(r.err||'NOFILE');this.vm.load(r.data,path.split('/').pop().toUpperCase());this.status('RUN '+path.split('/').pop().toUpperCase())}
enqueue(ev){this.ev.push(ev);if(this.ev.length>64)this.ev.shift()}
processInput(){const ev=this.ev.shift();if(!ev)return;if(ev.type==='line')this.cmd(ev.data)}
cmd(c){const t=c.trim();if(!t)return;const u=t.toUpperCase();if(u==='HELP')return this.print('START STOP PAUSE CONT RESET STATUS LS CAT WRITE DEL TRACE STEP JLS');
if(u==='LS')return this.print(this.fs.list('/').slice(0,8).join(' '));
if(u==='JLS')return this.print(this.fs.db.journal.slice(-4).map(j=>j.op+':'+j.path).join(' '));
if(u.startsWith('CAT ')){const r=this.fs.read(t.slice(4).trim());return this.print(r.ok?r.data.slice(0,80):(r.err||'NOFILE'))}
if(u.startsWith('START ')||u.startsWith('RUN ')){const p=t.split(/\s+/)[1];return this.runScript(p)}
if(u.startsWith('WRITE ')){const m=t.match(/^WRITE\s+(\S+)\s+(.+)$/i);if(!m)return this.print('E CMD');const r=this.fs.writeAtomic(m[1],m[2]);return this.print(r.ok?'OK':r.err)}
if(u.startsWith('DEL ')){const r=this.fs.del(t.slice(4).trim());return this.print(r.ok?'OK':r.err||'NOFILE')}
if(u==='STATUS')return this.print(`STATE=${this.vm.state} PC=${this.vm.pc} OPS=${this.vm.opsTotal}`);
if(u==='STOP'){this.vm.signal('STOP');return this.status('STOP')}
if(u==='PAUSE'){this.vm.signal('PAUSE');return this.status('PAUSED')}
if(u==='CONT'){this.vm.signal('CONT');return this.status(this.vm.state)}
if(u==='RESET'){this.vm.signal('RESET');return this.status('RESET')}
if(u==='TRACE'){this.vm.trace=!this.vm.trace;return this.print('TRACE '+(this.vm.trace?'ON':'OFF'))}
if(u==='STEP'){if(this.vm.state==='PAUSED'||this.vm.state==='IDLE'){if(this.vm.state==='IDLE'&&this.vm.prog.length===0)return this.print('NOPROG');this.vm.state='RUNNING';this.vm.step(1);if(this.vm.state==='RUNNING')this.vm.state='PAUSED';return this.status('STEP')}return this.print('BUSY')}
this.vm.load(t,'INLINE')}
bind(){window.addEventListener('keydown',e=>{const now=Date.now();if(now-this.lastKeyTs<12)return;this.lastKeyTs=now;if(this.handleKey(e))e.preventDefault()});}}

window.LCD={DisplayDriver,VFS,Parser,VM,Terminal,SYS};
if(!document.getElementById('grid')) return;
const display=new DisplayDriver(document.getElementById('grid'));const fs=new VFS();const parser=new Parser(fs);const ui={print:()=>{},row:()=>{},status:()=>{}};const vm=new VM({ui,parser,fs});const term=new Terminal(display,fs,vm);ui.print=t=>term.print(t);ui.row=(y,t)=>term.row(y,t);ui.status=t=>term.status(t);

const kbBtn=document.getElementById('kbBtn');const dsp=document.getElementById('display');const kbInput=document.getElementById('kbInput');
const focusKeyboard=()=>{dsp.focus();kbInput.focus();term.status('KBD ON')};
kbBtn.addEventListener('click',focusKeyboard);kbBtn.addEventListener('touchstart',()=>setTimeout(focusKeyboard,0),{passive:true});
kbInput.addEventListener('input',e=>{const v=e.target.value||'';for(const ch of v)term.acceptChar(ch);e.target.value=''});
kbInput.addEventListener('keydown',e=>{if(term.handleKey(e))e.preventDefault();});
setInterval(()=>{term.processInput();vm.step();},20);
})();
