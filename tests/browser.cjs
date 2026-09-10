const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const screenshotDir = process.env.SCREENSHOT_DIR || '/tmp/portfolio-checks';
const launchOptions = { headless: true, args: ['--enable-unsafe-swiftshader'] };
if (process.env.CHROME_PATH) launchOptions.executablePath = process.env.CHROME_PATH;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  await fs.mkdir(screenshotDir, {recursive: true});
  const browser = await chromium.launch(launchOptions);
  const errors = [];
  const failures = [];
  const test = async (name, fn) => {
    try { await fn(); console.log(`PASS ${name}`); }
    catch (error) { failures.push(name); console.error(`FAIL ${name}\n${error.stack}`); }
  };
  try {
    const desktopContext = await browser.newContext({viewport:{width:1440,height:1000}});
    const page = await desktopContext.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(BASE, {waitUntil:'networkidle'});
    await test('3D is lazy; content and local assets are complete', async () => {
      assert.equal(await page.locator('.skill-node-button').count(), 0);
      const bad = await page.evaluate(() => {
        const links = [...document.querySelectorAll('a[href^="#"]')];
        const broken = links.filter(a => !document.getElementById(a.hash.slice(1))).map(a => a.outerHTML);
        const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
        return {broken, duplicates:ids.filter((id,i) => ids.indexOf(id) !== i)};
      });
      assert.deepEqual(bad, {broken:[],duplicates:[]});
      for (const image of await page.locator('img').all()) {
        await image.scrollIntoViewIfNeeded();
        await image.evaluate(img => img.decode());
        assert.ok(await image.evaluate(img => img.naturalWidth > 0));
      }
      assert.equal(await page.locator('#riskControls').isDisabled(), false);
    });
    await test('risk boundaries, rule floor, ML weight and Python rounding', async () => {
      const cases = [
        [40,90,50,65,'Высокий'], [0,0,0,0,'Низкий'], [100,0,100,100,'Высокий'],
        [20,20,50,20,'Низкий'],[21,21,50,21,'Средний'],[54,54,50,54,'Средний'],
        [55,55,50,55,'Высокий'],[0,1,50,0,'Низкий'],[0,3,50,2,'Низкий'],[40,90,0,40,'Средний']
      ];
      for (const [rule,ml,weight,score,level] of cases) {
        await page.evaluate(values => {
          ['ruleRange','mlRange','weightRange'].forEach((id,i) => {const el=document.getElementById(id);el.value=values[i];el.dispatchEvent(new Event('input',{bubbles:true}));});
        }, [rule,ml,weight]);
        assert.equal(await page.locator('#riskScore').textContent(),String(score));
        assert.equal(await page.locator('#riskLevel').textContent(),level);
      }
      await page.locator('#ruleRange').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('#ruleOutput').textContent(),'41');
    });
    await page.locator('#skills3d').scrollIntoViewIfNeeded();
    await page.waitForSelector('.skill-node-button');
    await test('sphere selection, related project links and keyboard controls', async () => {
      await page.locator('#spherePause').click();
      const buttons = page.locator('.skill-node-button');
      let checks = 0;
      for (const button of await buttons.all()) {
        if (!await button.isVisible()) continue;
        const name=await button.textContent();
        await button.focus();await page.keyboard.press('Enter');
        assert.equal(await page.locator('#skillDetailTitle').textContent(),name);
        for (const link of await page.locator('#skillDetailProjects a').all()) {
          const href = await link.getAttribute('href');
          assert.ok(href.length>1);
          assert.equal(await page.locator(href).count(),1);
        }
        checks++;
      }
      assert.ok(checks>3);
      const projectLink=page.locator('#skillDetailProjects a').first();
      const href=await projectLink.getAttribute('href');
      await projectLink.click();
      await page.waitForFunction(hash=>location.hash===hash,href);
      await page.locator('#skills3d').scrollIntoViewIfNeeded();
      const before = await buttons.first().locator('..').getAttribute('style');
      await page.locator('#skills3d').focus();await page.keyboard.press('ArrowRight');await wait(80);
      assert.notEqual(await buttons.first().locator('..').getAttribute('style'),before);
    });
    await test('pause stops every motion; resume works with button focused', async () => {
      const pause=page.locator('#spherePause');
      if (await pause.getAttribute('aria-pressed')!=='true') await pause.click();
      const state=()=>page.locator('.skill-node').evaluateAll(nodes=>nodes.map(n=>n.style.transform).join('|'));
      await wait(100);const before=await state();await wait(200);assert.equal(await state(),before);
      await pause.click();await wait(200);assert.notEqual(await state(),before);
      await pause.click();
    });
    await test('desktop WCAG A/AA accessibility', async () => {
      const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
      await fs.writeFile(`${screenshotDir}/axe-desktop.json`,JSON.stringify(result.violations,null,2));
      assert.deepEqual(result.violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).join(', ')}`),[]);
    });
    await test('responsive layout at 320, 390, 768, 1024, 1440 and 1920 px', async () => {
      for (const width of [320,390,768,1024,1440,1920]) {
        await page.setViewportSize({width,height:1000});await wait(80);
        const layout=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,skipBottom:document.querySelector('.skip-link').getBoundingClientRect().bottom}));
        const overflowing=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.right>innerWidth+1 && r.width>0}).map(el=>({tag:el.tagName,cls:el.className,text:el.textContent.slice(0,70),right:el.getBoundingClientRect().right})));
        assert.ok(layout.scroll<=layout.viewport,`Overflow at ${width}: ${JSON.stringify({layout,overflowing})}`);
        assert.ok(layout.skipBottom<0,`Skip link visible without focus: ${JSON.stringify(layout)}`);
      }
    });
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('#skills3d').scrollIntoViewIfNeeded();await wait(100);
    await page.screenshot({path:`${screenshotDir}/sphere-desktop.png`});
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({path:`${screenshotDir}/hero-desktop.png`});
    await page.screenshot({path:`${screenshotDir}/desktop-full.png`,fullPage:true});

    const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
    const mobile=await mobileContext.newPage();
    mobile.on('pageerror',error=>errors.push(error.message));
    await mobile.goto(BASE,{waitUntil:'networkidle'});
    await test('mobile taps, pointer cancellation, and readable labels', async()=>{
      await mobile.locator('#skills3d').scrollIntoViewIfNeeded();await mobile.waitForSelector('.skill-node-button');
      await mobile.locator('#spherePause').tap();
      const buttons=mobile.locator('.skill-node-button:visible');
      const first=buttons.first(); const name=await first.textContent();await first.tap();await wait(100);
      assert.equal(await mobile.locator('#skillDetailTitle').textContent(),name);
      assert.equal(await mobile.locator('.skill-node-button:visible').count(), await mobile.locator('#skillGroups [data-sphere]').count());
      const rect=await mobile.locator('#skills3d').boundingBox();
      const cdp=await mobile.context().newCDPSession(mobile);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+20,y:rect.y+90}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      await cdp.detach();
      assert.equal(await mobile.locator('#skills3d').evaluate(el=>el.classList.contains('is-dragging')),false);
    });
    await test('mobile accessibility',async()=>{
      const result=await new AxeBuilder({page:mobile}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
      await fs.writeFile(`${screenshotDir}/axe-mobile.json`,JSON.stringify(result.violations,null,2));
      assert.deepEqual(result.violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).join(', ')}`),[]);
    });
    await mobile.screenshot({path:`${screenshotDir}/sphere-mobile.png`});
    await mobile.locator('.project-image img').scrollIntoViewIfNeeded();await mobile.locator('.project-image img').evaluate(img=>img.decode());
    await mobile.screenshot({path:`${screenshotDir}/neberi-mobile.png`});
    await mobile.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await mobile.screenshot({path:`${screenshotDir}/hero-mobile.png`});
    await mobile.screenshot({path:`${screenshotDir}/mobile-full.png`,fullPage:true});

    await test('reduced motion and offscreen suspension',async()=>{
      const reduced=await browser.newPage({reducedMotion:'reduce',viewport:{width:1200,height:900}});
      await reduced.addInitScript(()=>{
        const original=WebGL2RenderingContext.prototype.drawArrays;
        window.drawCount=0;
        WebGL2RenderingContext.prototype.drawArrays=function(...args){window.drawCount++;return original.apply(this,args);};
      });
      await reduced.goto(BASE);await reduced.locator('#skills3d').scrollIntoViewIfNeeded();await reduced.waitForSelector('.skill-node-button:visible');
      await wait(100);const before=await reduced.locator('.skill-node').first().getAttribute('style');await wait(150);
      assert.equal(await reduced.locator('.skill-node').first().getAttribute('style'),before);
      assert.equal(await reduced.locator('#spherePause').isDisabled(),true);
      await reduced.emulateMedia({reducedMotion:'no-preference'});await wait(150);
      assert.notEqual(await reduced.locator('.skill-node').first().getAttribute('style'),before);
      await reduced.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await wait(100);
      const count=await reduced.evaluate(()=>window.drawCount);await wait(200);
      assert.equal(await reduced.evaluate(()=>window.drawCount),count);
      await reduced.close();
    });
    await test('no JavaScript: content, skill links, photo, static demo',async()=>{
      const nojs=await browser.newPage({javaScriptEnabled:false});await nojs.goto(BASE);
      assert.equal(await nojs.locator('#ruleRange').isDisabled(),true);
      assert.equal(await nojs.locator('#skillGroups [data-skill]').count(),27);
      assert.ok(await nojs.locator('#optitrade').isVisible());
      await nojs.getByRole('link',{name:'Посмотреть проекты'}).click();assert.equal(new URL(nojs.url()).hash,'#work');
      await nojs.close();
    });
    await test('blocked module and unavailable WebGL keep a usable fallback',async()=>{
      for (const mode of ['module','webgl']) {
        const fallback=await browser.newPage();
        if(mode==='module') await fallback.route('**/skills-3d.js',route=>route.abort());
        else await fallback.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:get.call(this,type,...args);};});
        await fallback.goto(BASE);await fallback.locator('#skills3d').scrollIntoViewIfNeeded();
        await fallback.waitForSelector('#skills3d.is-unavailable');
        assert.ok(await fallback.locator('#sphereStatus').isVisible());
        assert.equal(await fallback.locator('#skillGroups [data-skill]').count(),27);
        await fallback.close();
      }
    });
    await test('WebGL context loss releases scene and preserves content',async()=>{
      await page.locator('#skills3d').scrollIntoViewIfNeeded();
      await page.locator('canvas').dispatchEvent('webglcontextlost',{cancelable:true});
      assert.equal(await page.locator('canvas').count(),0);
      assert.ok(await page.locator('#sphereStatus').isVisible());
    });
    await test('no uncaught JavaScript errors',async()=>assert.deepEqual(errors,[]));
  } finally { await browser.close(); }
  if (failures.length) {console.error(`Failed: ${failures.join(', ')}`);process.exitCode=1;}
})();
