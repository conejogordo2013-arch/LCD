(async()=>{
  let pw;try{pw=require('playwright');}catch(e){console.log('SKIP playwright not installed');process.exit(0)}
  const {chromium}=pw;const http=require('http'),fs=require('fs'),path=require('path');
  const srv=http.createServer((req,res)=>{const p=req.url==='/'?'/index.html':req.url;const f=path.join(process.cwd(),p);if(!fs.existsSync(f)){res.statusCode=404;return res.end('nf')}res.end(fs.readFileSync(f));});
  await new Promise(r=>srv.listen(8787,r));
  const browser=await chromium.launch();const page=await browser.newPage();
  await page.goto('http://127.0.0.1:8787/index.html');
  await page.click('#kbBtn');
  await page.keyboard.type('STATUS');await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.screenshot({path:'visual_headless.png',fullPage:true});
  await browser.close();srv.close();console.log('visual headless ok');
})();
