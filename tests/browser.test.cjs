const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const pauseFree={reducedMotion:'reduce'};
async function launch(){return chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});}
async function setup(t,viewport){
  const browser=await launch();t.after(()=>browser.close());
  const context=await browser.newContext({...pauseFree,viewport,acceptDownloads:true});
  const page=await context.newPage(),errors=[],remote=[];page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(10000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith('http://127.0.0.1:'))remote.push(request.url());});
  page.on('dialog',d=>d.accept());
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  t.after(()=>{assert.deepEqual(errors,[],'page errors');assert.deepEqual(remote,[],'unexpected network');});
  return {page,context};
}
async function run(page){await page.locator('#sem-run').click();await page.locator('#sem-findings').waitFor();}
async function evidence(page){
  for(let i=0;i<7;i++){await page.locator('#flow-action').click();assert.match(await page.locator('#sem-reference blockquote').innerText(),/./);assert.equal(await page.locator('#sem-reference').evaluate(n=>n===document.activeElement),true);}
  assert.match(await page.locator('#flow-next').innerText(),/证据已全部打开/);
}
async function confirm(page){await page.locator('#sem-review').selectOption({label:'等待客户补充资料'});await page.locator('#sem-note').fill('合成演示：当前曲线及介质条件需补充。');await page.locator('#sem-ack').check();await page.locator('#sem-save-review').click();}
async function download(page){const pending=page.waitForEvent('download');await page.locator('#sem-export').click();const file=await pending;return JSON.parse(await fs.readFile(await file.path(),'utf8'));}
async function noOverflow(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'page overflows viewport');}
for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:740}]){
  test(`complete synthetic inquiry path at ${viewport.width}px`,async t=>{
    const {page}=await setup(t,viewport);
    assert.equal(await page.locator('#sem-export').isDisabled(),true);await noOverflow(page);
    await page.locator('#sem-expression').selectOption('litres');await run(page);
    assert.equal(await page.locator('#sem-findings .finding-card').count(),3);await noOverflow(page);
    assert.equal(await page.locator('#sem-save-review').isDisabled(),true);assert.equal(await page.locator('#sem-export').isDisabled(),true);
    await evidence(page);assert.equal(await page.locator('#sem-save-review').isDisabled(),true);
    await confirm(page);assert.equal(await page.locator('#sem-export').isEnabled(),true);
    await page.locator('#sem-generate').click();await page.locator('#sem-draft').fill('<script>合成草稿</script>');
    const data=await download(page);assert.equal(data.report_type,'SYNTHETIC_VERIFICATION_REPORT');assert.equal(data.expression,'litres');assert.equal(data.facts[0].value,'85');assert.equal(data.workflow.viewed_evidence.length,7);assert.equal(data.workflow.confirmation.status,'等待客户补充资料');assert.equal(data.customer_confirmed,false);assert.equal(data.final_model,null);assert.equal(data.external_writes,0);assert.ok(Object.values(data.metrics).every(x=>x===null));assert.equal(data.current_local_edits.saved,false);assert.equal(data.current_local_edits.draft,'<script>合成草稿</script>');
    await page.locator('#sem-draft').fill('【合成演示 · 尚未发送】请补充当前工况曲线、乙二醇适用性及NPSH资料。');await noOverflow(page);await fs.mkdir(path.join(root,'test-results'),{recursive:true});await page.locator('#sem-findings').screenshot({path:path.join(root,`test-results/evidence-${viewport.width}.png`)});await page.locator('.workflow-nav').screenshot({path:path.join(root,`test-results/workflow-${viewport.width}.png`)});await page.locator('#sem-human').screenshot({path:path.join(root,`test-results/review-${viewport.width}.png`)});
    await page.locator('#sem-note').fill('修改后的合成备注');assert.equal(await page.locator('#sem-export').isDisabled(),true);
    // Saving a draft must not act as a human confirmation.
    await page.locator('#sem-save-draft').click();assert.equal(await page.locator('#sem-export').isDisabled(),true);
    await page.locator('#sem-save-review').click();await page.locator('#sem-invalidate').click();
    assert.match(await page.locator('#sem-badge').innerText(),/来源失效/);assert.equal(await page.locator('#sem-human-fields').evaluate(n=>n.disabled),true);assert.equal(await page.locator('#sem-note').inputValue(),'');assert.equal(await page.locator('#sem-draft').inputValue(),'');
    const diagnostic=await download(page);assert.equal(diagnostic.report_type,'SYNTHETIC_DIAGNOSTIC_ONLY');assert.equal(diagnostic.workflow,null);assert.deepEqual(diagnostic.audit,[]);assert.deepEqual(diagnostic.candidates,[]);await noOverflow(page);
  });
}
test('preset changes, reruns, cancellation races, rejection and reset',async t=>{
  const {page}=await setup(t,{width:1280,height:900});await run(page);await evidence(page);await confirm(page);
  await page.locator('[data-scenario="revision"]').click();assert.equal(await page.locator('#sem-export').isDisabled(),true);assert.equal(await page.locator('#sem-note').inputValue(),'');await run(page);assert.match(await page.locator('#sem-output').innerText(),/95/);assert.match(await page.locator('#flow-next').innerText(),/0 \/ 7/);
  await page.locator('#sem-run').click();await page.locator('[data-scenario="pressure"]').click();await page.waitForTimeout(900);assert.equal(await page.locator('#sem-findings').count(),0);assert.equal(await page.locator('#sem-export').isDisabled(),true);
  await run(page);assert.match(await page.locator('#sem-output').innerText(),/出口表压/);
  await page.locator('#sem-corrupt').check();await page.locator('#sem-run').click();await page.waitForFunction(()=>document.querySelector('#sem-badge').textContent.includes('引用拒绝'));
  assert.equal(await page.locator('#sem-findings').count(),0);const diagnostic=await download(page);assert.equal(diagnostic.report_type,'SYNTHETIC_DIAGNOSTIC_ONLY');assert.equal(diagnostic.workflow.confirmation,null);assert.deepEqual(diagnostic.facts,[]);
  await page.locator('#sem-reset').click();assert.equal(await page.locator('#sem-expression').inputValue(),'direct');assert.equal(await page.locator('#sem-corrupt').isChecked(),false);assert.equal(await page.locator('#sem-export').isDisabled(),true);
  await page.locator('#golden-run').click();assert.equal(await page.locator('#golden-output tbody tr').count(),12);assert.match(await page.locator('#golden-output h3').innerText(),/12 \/ 12/);
  await page.locator('.legacy-demo summary').click();await page.locator('#run').click();await page.waitForFunction(()=>document.querySelector('#result-badge').textContent.includes('阻断'));assert.match(await page.locator('#result').innerText(),/58/);await page.locator('#invalidate').click();assert.equal(await page.locator('#review-fields').evaluate(n=>n.disabled),true);
});
test('keyboard path to evidence and live region with reduced motion',async t=>{
  const {page}=await setup(t,{width:390,height:844});await run(page);await page.locator('#flow-action').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#sem-reference').evaluate(n=>n===document.activeElement),true);assert.match(await page.locator('#flow-next').innerText(),/1 \/ 7/);assert.equal(await page.locator('[aria-current="step"]').count(),1);
});
test('HTTP deployment keeps CSP isolation and serves the script order',async t=>{
  const server=http.createServer(async(req,res)=>{try{const name=req.url==='/'?'index.html':req.url.slice(1);if(!['index.html','model.js','workflow.js','app.js','styles.css'].includes(name)){res.writeHead(404).end();return;}res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(path.join(root,name)));}catch{res.writeHead(500).end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const {page}=await setup(t,{width:1280,height:900});await page.goto(`http://127.0.0.1:${server.address().port}/`);await run(page);assert.equal(await page.evaluate(()=>typeof DemoWorkflow.report),'function');
  assert.equal(await page.evaluate(async()=>{try{await fetch('/blocked');return false;}catch{return true;}}),true);await evidence(page);await confirm(page);assert.equal((await download(page)).report_type,'SYNTHETIC_VERIFICATION_REPORT');
});
