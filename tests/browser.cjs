const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const screenshotDir = process.env.SCREENSHOT_DIR || '/tmp/portfolio-checks';
const launchOptions = { headless: true, args: ['--enable-unsafe-swiftshader'] };
if (process.env.CHROME_PATH) launchOptions.executablePath = process.env.CHROME_PATH;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const skipStartup = async page => {
  const skip = page.locator('.boot-skip');
  if (!await skip.isVisible()) return;
  await skip.dispatchEvent('click');
  await page.waitForFunction(() => !document.documentElement.classList.contains('boot-enabled'));
};
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
    await skipStartup(page);
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
        if (await image.isVisible()) await image.evaluate(img => img.scrollIntoView({behavior: "instant", block: "center"}));
        await image.evaluate(img => img.decode());
        assert.ok(await image.evaluate(img => img.naturalWidth > 0));
      }
      assert.equal(await page.locator('#riskControls').isDisabled(), false);
	  const dependencies = await page.evaluate(() => ({
		remoteFonts: [...document.querySelectorAll('link')].map(link => link.href).filter(href => /fonts\.googleapis|fonts\.gstatic/.test(href)),
		assetVersions: [...document.querySelectorAll('link[rel="stylesheet"],link[rel="modulepreload"],script[src]')].map(element => new URL(element.href || element.src).searchParams.get('v')),
		fonts: ['400 16px "IBM Plex Sans"','400 16px "JetBrains Mono"','500 16px "Oswald"'].map(font => document.fonts.check(font)),
	  }));
	  assert.deepEqual(dependencies.remoteFonts, []);
	  assert.equal(dependencies.assetVersions.length,9);
	  assert.equal(dependencies.assetVersions.every(version => version === dependencies.assetVersions[0] && Boolean(version)),true);
	  assert.deepEqual(dependencies.fonts, [true,true,true]);
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
      const buttons = page.locator('.skill-node-button');
      assert.equal(await page.locator('.skill-node-button[aria-pressed="true"]').count(),0);
      assert.equal(await page.locator('#skills3d').getAttribute('data-active-connections'),'0');
      const sql=page.getByRole('button',{name:/^SQL · PostgreSQL · SQLAlchemy/});
      await sql.evaluate(element=>element.click());
      assert.equal(await page.locator('#skills3d').getAttribute('data-selected-category'),'backend');
      assert.equal(await page.locator('#skills3d').getAttribute('data-active-connections'),'3');
      assert.equal(await page.locator('.skill-node-button.is-related').count(),3);
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
      await page.locator('#skills3d').focus();await page.keyboard.press('ArrowRight');
      await page.waitForFunction(before => document.querySelector('.skill-node')?.getAttribute('style') !== before,before);
    });
    await test('sphere pauses on selection, keeps rotating on hover and resumes on pointer movement', async () => {
      await page.locator('#skills3d').evaluate(element=>element.scrollIntoView({behavior:'instant',block:'center'}));
      await wait(120);
      const state=()=>page.locator('.skill-node').evaluateAll(nodes=>nodes.map(n=>n.style.transform).join('|'));
      const first=page.locator('.skill-node-button:visible').first();
      await first.evaluate(element=>element.click());await wait(80);const selected=await state();await wait(440);assert.equal(await state(),selected);
      await page.locator('#skills3d').dispatchEvent('pointermove',{pointerType:'mouse',clientX:30,clientY:30});
      await page.waitForFunction(selected => [...document.querySelectorAll('.skill-node')].map(node=>node.style.transform).join('|') !== selected,selected,{timeout:1500});
      const hovered=await state();
      await first.dispatchEvent('pointerenter',{pointerType:'mouse'});
      await page.waitForFunction(hovered => [...document.querySelectorAll('.skill-node')].map(node=>node.style.transform).join('|') !== hovered,hovered,{timeout:1500});
    });
    await test('desktop WCAG A/AA accessibility', async () => {
      const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
      await fs.writeFile(`${screenshotDir}/axe-desktop.json`,JSON.stringify(result.violations,null,2));
      assert.deepEqual(result.violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).join(', ')}`),[]);
    });
    await test('responsive layout from 320 through 2560 px', async () => {
      for (const width of [320,390,768,1024,1440,1920,2560]) {
        await page.setViewportSize({width,height:1000});await wait(80);
        const layout=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,skipBottom:document.querySelector('.skip-link').getBoundingClientRect().bottom,shellWidth:document.querySelector('.section-shell').offsetWidth,ambientHeight:document.querySelector('.ambient').offsetHeight,projectColumns:getComputedStyle(document.querySelector('.project-grid')).gridTemplateColumns.split(' ').length,projectImageWidth:document.querySelector('.project-image').offsetWidth,sphereHeight:document.querySelector('.skills-3d-stage').offsetHeight,aboutCopyWidth:document.querySelector('.about-copy').offsetWidth,featureGap:document.querySelector('.feature-grid').offsetHeight-document.querySelector('.feature-copy').offsetHeight}));
        const overflowing=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.right>innerWidth+1 && r.width>0}).map(el=>({tag:el.tagName,cls:el.className,text:el.textContent.slice(0,70),right:el.getBoundingClientRect().right})));
        assert.ok(layout.scroll<=layout.viewport,`Overflow at ${width}: ${JSON.stringify({layout,overflowing})}`);
        assert.ok(layout.skipBottom<0,`Skip link visible without focus: ${JSON.stringify(layout)}`);
		if(width===1440) {
		  assert.equal(layout.shellWidth,1280);
		  assert.equal(layout.projectColumns,2);
		  assert.equal(layout.projectImageWidth,340);
		  assert.equal(layout.sphereHeight,490);
		  assert.equal(layout.aboutCopyWidth,500);
		}
		if(width>=1920) {
		  assert.ok(layout.shellWidth>1600,JSON.stringify(layout));
		  assert.ok(layout.ambientHeight>1200,JSON.stringify(layout));
		  assert.equal(layout.projectColumns,3);
		  assert.equal(layout.projectImageWidth,440);
		  assert.equal(layout.sphereHeight,560);
		  assert.equal(layout.aboutCopyWidth,640);
		  assert.ok(layout.featureGap<100,JSON.stringify(layout));
		}
      }
    });
    await page.setViewportSize({width:1440,height:1000});
	await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await wait(900);
	await test('desktop hero secondary windows bracket the welcome window',async()=>{
	  const geometry=await page.evaluate(()=>{
		const rect=selector=>document.querySelector(selector).getBoundingClientRect();
		const welcome=rect('.profile-window');
		const portrait=rect('.hero-portrait');
		const workflow=rect('.workflow-window');
		return {welcomeTop:welcome.top,welcomeBottom:welcome.bottom,portraitTop:portrait.top,workflowBottom:workflow.bottom};
	  });
	  assert.ok(geometry.portraitTop<geometry.welcomeTop,JSON.stringify(geometry));
	  assert.ok(geometry.workflowBottom>geometry.welcomeBottom && geometry.workflowBottom-geometry.welcomeBottom<35,JSON.stringify(geometry));
	  assert.equal(await page.locator('.hero-portrait .xp-window-action').count(),0);
	  assert.equal((await page.locator('.hero-portrait .xp-window-name').textContent()).trim().endsWith('grigorii.jpg'),true);
	});
    await page.locator('#skills3d').scrollIntoViewIfNeeded();await wait(100);
    await page.screenshot({path:`${screenshotDir}/sphere-desktop.png`});
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({path:`${screenshotDir}/hero-desktop.png`});
    await page.screenshot({path:`${screenshotDir}/desktop-full.png`,fullPage:true});

    const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
    const mobile=await mobileContext.newPage();
    mobile.on('pageerror',error=>errors.push(error.message));
    await mobile.goto(BASE,{waitUntil:'networkidle'});
    await skipStartup(mobile);
    await test('mobile presents dense sections progressively', async()=>{
      assert.equal(await mobile.locator('#demo').evaluate(details=>details.open),false);
      assert.equal(await mobile.locator('.stack-disclosure').evaluate(details=>details.open),true);
      const layout=await mobile.evaluate(()=>{
        const grid=document.querySelector('.project-grid');
        const cards=[...grid.children].filter(element=>element.matches('.project-card'));
		return {
		  height:document.documentElement.scrollHeight,
		  overflow:grid.scrollWidth-grid.clientWidth,
		  trailingSpace:grid.scrollWidth-cards.at(-1).offsetLeft-cards.at(-1).offsetWidth,
		  firstTop:cards[0].offsetTop,
		  secondTop:cards[1].offsetTop,
		  secondLeft:cards[1].offsetLeft,
		  cardHeights:cards.map(card=>card.getBoundingClientRect().height),
		  barPadding:parseFloat(getComputedStyle(cards[0].querySelector('.xp-cardbar')).paddingTop),
		};
      });
      assert.ok(layout.height<10000,JSON.stringify(layout));
      assert.ok(layout.overflow>200,JSON.stringify(layout));
	  assert.ok(layout.trailingSpace<2,JSON.stringify(layout));
      assert.equal(layout.firstTop,layout.secondTop);
      assert.ok(layout.secondLeft>300,JSON.stringify(layout));
	  assert.equal(new Set(layout.cardHeights.map(Math.round)).size,1,JSON.stringify(layout));
	  assert.ok(layout.barPadding>=8,JSON.stringify(layout));
	  assert.equal(await mobile.locator('.mobile-project-links:visible').count(),6);
	  assert.equal(await mobile.locator('#daria .mobile-project-links a').count(),2);
    });
    await test('mobile hero keeps the portrait available while scrolling', async()=>{
      const portrait=mobile.locator('.hero-portrait');
      await portrait.scrollIntoViewIfNeeded();await wait(100);
      const state=await portrait.evaluate(element=>{
        const rect=element.getBoundingClientRect();
        return {opacity:getComputedStyle(element.closest('.desktop-side')).opacity,top:rect.top,bottom:rect.bottom,viewport:innerHeight,currentSrc:element.querySelector('img').currentSrc};
      });
      assert.equal(state.opacity,'1');
      assert.ok(state.bottom>0 && state.top<state.viewport,JSON.stringify(state));
      assert.match(state.currentSrc,/grigorii-belyaev-(480|800)\.webp$/);
    });
    await test('mobile taps, pointer cancellation, and readable labels', async()=>{
      await mobile.locator('#skills3d').scrollIntoViewIfNeeded();await mobile.waitForSelector('.skill-node-button');
      const buttons=mobile.locator('.skill-node-button:visible');
      const rect=await mobile.locator('#skills3d').boundingBox();
      const cdp=await mobile.context().newCDPSession(mobile);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+20,y:rect.y+90}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      await cdp.detach();
      assert.equal(await mobile.locator('#skills3d').evaluate(el=>el.classList.contains('is-dragging')),false);
	  assert.equal(await mobile.locator('#sphereLeft, #sphereRight').count(),0);
	  const first=buttons.first(); const name=await first.textContent();await first.evaluate(element=>element.click());
	  await mobile.waitForFunction(()=>{const top=document.querySelector('#skillDetail').getBoundingClientRect().top;return top>70&&top<130;});
	  assert.equal(await mobile.locator('#skillDetailTitle').textContent(),name);
	  const visibleCount=await mobile.locator('.skill-node-button:visible').count();
	  const totalCount=await mobile.locator('#skillGroups [data-sphere]').count();
	  assert.ok(visibleCount>=6 && visibleCount<totalCount,JSON.stringify({visibleCount,totalCount}));
	  const panelStyle=await mobile.locator('#skillDetail').evaluate(element=>({shadow:getComputedStyle(element).boxShadow,borders:['Top','Right','Bottom','Left'].map(side=>getComputedStyle(element)[`border${side}Color`])}));
	  assert.equal(panelStyle.shadow,'none');
	  assert.equal(new Set(panelStyle.borders).size,1,JSON.stringify(panelStyle));
	  await mobile.locator('#skills3d').evaluate(element=>element.scrollIntoView({behavior:'instant',block:'center'}));await wait(100);
	  const nodeState=()=>mobile.locator('.skill-node').evaluateAll(nodes=>nodes.map(node=>node.style.transform).join('|'));
	  const beforeResume=await nodeState();await wait(420);
	  assert.notEqual(await nodeState(),beforeResume);
    });
	await test('skill list links align the correct project card',async()=>{
	  const link=mobile.locator('#skillGroups [data-skill="NLP / n-grams"] a');
	  await link.evaluate(element=>element.click());
	  await mobile.waitForFunction(()=>location.hash==='#ocr'&&Math.abs(document.querySelector('#ocr').getBoundingClientRect().top)<80);
	  const alignment=await mobile.evaluate(()=>{
		const grid=document.querySelector('.project-grid').getBoundingClientRect();
		const card=document.querySelector('#ocr').getBoundingClientRect();
		return {gridLeft:grid.left,gridRight:grid.right,cardLeft:card.left,cardRight:card.right};
	  });
	  assert.ok(alignment.cardLeft>=alignment.gridLeft-2&&alignment.cardRight<=alignment.gridRight+2,JSON.stringify(alignment));
	  await mobile.locator('#skills3d').evaluate(element=>element.scrollIntoView({behavior:'instant',block:'center'}));
	});
    await test('mobile accessibility',async()=>{
      const result=await new AxeBuilder({page:mobile}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
      await fs.writeFile(`${screenshotDir}/axe-mobile.json`,JSON.stringify(result.violations,null,2));
      assert.deepEqual(result.violations.map(v=>`${v.id}: ${v.nodes.map(n=>n.target.join(' ')).join(', ')}`),[]);
    });
    await mobile.screenshot({path:`${screenshotDir}/sphere-mobile.png`});
    await mobile.locator('.stack-disclosure > summary').click();
    await mobile.locator('.project-image img').scrollIntoViewIfNeeded();await mobile.locator('.project-image img').evaluate(img=>img.decode());
    await mobile.screenshot({path:`${screenshotDir}/neberi-mobile.png`});
    await mobile.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await mobile.screenshot({path:`${screenshotDir}/hero-mobile.png`});
    await mobile.screenshot({path:`${screenshotDir}/mobile-full.png`,fullPage:true});

	const landscapeContext=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});
	const landscape=await landscapeContext.newPage();
	await landscape.goto(BASE,{waitUntil:'networkidle'});await skipStartup(landscape);
	await test('mobile landscape keeps the compact visual contract',async()=>{
	  const state=await landscape.evaluate(()=>({
		overflow:document.documentElement.scrollWidth-innerWidth,
		stack:document.querySelector('.stack-disclosure').open,
		demo:document.querySelector('#demo').open,
		sectionLoader:document.documentElement.classList.contains('section-loading-enabled'),
			topNoteCount:document.querySelectorAll('.top-note').length,
	  }));
	  assert.ok(state.overflow<=0,JSON.stringify(state));
	  assert.equal(state.stack,true);assert.equal(state.demo,false);
		  assert.equal(state.sectionLoader,false);assert.equal(state.topNoteCount,0);
	});
	await landscape.screenshot({path:`${screenshotDir}/mobile-landscape.png`,fullPage:true});
	await landscapeContext.close();

    await test('boot content stays centered on a mobile viewport',async()=>{
      const boot=await mobileContext.newPage();
      await boot.goto(`${BASE}?boot-center=1`,{waitUntil:'domcontentloaded'});
      await boot.waitForFunction(()=>document.documentElement.dataset.bootState==='post');
	  assert.equal(await boot.locator('.boot-skip small').isVisible(),false);
      const centered=async selector=>boot.locator(selector).evaluate(element=>{
        const rect=element.getBoundingClientRect();
        return {x:Math.abs(rect.left+rect.width/2-innerWidth/2),y:Math.abs(rect.top+rect.height/2-innerHeight/2)};
      });
      const post=await centered('.boot-bios');
      assert.ok(post.x<2 && post.y<2,JSON.stringify(post));
      await boot.evaluate(()=>document.documentElement.dataset.bootState='xp');
      const xp=await centered('.boot-xp');
      assert.ok(xp.x<2 && xp.y<2,JSON.stringify(xp));
      const mobileRunner=boot.locator('.boot-loader-runner');
      assert.equal(await mobileRunner.evaluate(el=>el.getAnimations()[0]?.playState),'running');
      const mobileRunnerBefore=await mobileRunner.evaluate(el=>getComputedStyle(el).left);
      await wait(120);
      const mobileRunnerAfter=await mobileRunner.evaluate(el=>getComputedStyle(el).left);
      assert.notEqual(mobileRunnerAfter,mobileRunnerBefore);
      await boot.locator('.boot-skip').click();
      await boot.close();
    });
	await test('desktop boot shows the Escape shortcut',async()=>{
	  const boot=await desktopContext.newPage();
	  await boot.goto(`${BASE}?desktop-escape=1`,{waitUntil:'domcontentloaded'});
	  assert.ok(await boot.locator('.boot-skip small').isVisible());
	  await boot.locator('.boot-skip').click();
	  await boot.close();
	});

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
      assert.equal(await nojs.locator('#skillGroups [data-skill]').count(),28);
      assert.equal(await nojs.locator('#skillGroups [data-skill="Java · базово"][data-sphere]').count(),1);
      assert.equal(await nojs.locator('#skillGroups [data-skill="C# · базово"]:not([data-sphere])').count(),1);
      assert.ok(await nojs.locator('#optitrade').isVisible());
      await nojs.getByRole('link',{name:'Открыть проекты'}).click();assert.equal(new URL(nojs.url()).hash,'#work');
      await nojs.close();
    });
    await test('blocked module and unavailable WebGL keep a usable fallback',async()=>{
      for (const mode of ['module','webgl']) {
        const fallback=await browser.newPage();
        if(mode==='module') await fallback.route(/\/skills-3d\.js(?:\?.*)?$/,route=>route.abort());
        else await fallback.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:get.call(this,type,...args);};});
        await fallback.goto(BASE);await skipStartup(fallback);await fallback.locator('#skills3d').scrollIntoViewIfNeeded();
        await fallback.waitForSelector('#skills3d.is-unavailable');
        assert.ok(await fallback.locator('#sphereStatus').isVisible());
        assert.equal(await fallback.locator('#skillGroups [data-skill]').count(),28);
        await fallback.close();
      }
    });
	await test('blocked motion script never leaves sections hidden',async()=>{
	  const fallback=await browser.newPage({viewport:{width:1200,height:900}});
	  await fallback.route(/\/motion\.js(?:\?.*)?$/,route=>route.abort());
	  await fallback.goto(BASE,{waitUntil:'networkidle'});
	  assert.equal(await fallback.locator('html').evaluate(element=>element.classList.contains('section-loading-enabled')),false);
	  assert.notEqual(await fallback.locator('#work').evaluate(element=>getComputedStyle(element).visibility),'hidden');
	  await fallback.close();
	});
    await test('WebGL context loss releases scene and preserves content',async()=>{
      await page.locator('#skills3d').scrollIntoViewIfNeeded();
      await page.locator('canvas').dispatchEvent('webglcontextlost',{cancelable:true});
      assert.equal(await page.locator('canvas').count(),0);
      assert.ok(await page.locator('#sphereStatus').isVisible());
    });
    await test('XP startup runs through POST, XP, app launch and remains skippable', async () => {
      const startupContext = await browser.newContext({viewport:{width:1440,height:1000}});
      const startup = await startupContext.newPage();
      await startup.goto(BASE,{waitUntil:'domcontentloaded'});
      await startup.evaluate(() => {
        window.__appStateHistory = [document.documentElement.dataset.appState];
        new MutationObserver(() => {
          const state = document.documentElement.dataset.appState;
          if (state && window.__appStateHistory.at(-1) !== state) window.__appStateHistory.push(state);
        }).observe(document.documentElement, {attributes:true, attributeFilter:['data-app-state']});
      });
      assert.ok(await startup.locator('html').evaluate(el => el.classList.contains('boot-enabled')));
      await startup.waitForFunction(() => document.documentElement.dataset.bootState === 'post');
      await startup.locator('.system-boot').click({position:{x:20,y:20}});
      await startup.mouse.wheel(0,120);
      assert.ok(await startup.locator('html').evaluate(el => el.classList.contains('boot-enabled')));
      await startup.waitForFunction(() => document.documentElement.dataset.bootState === 'xp');
      const bootRunner=startup.locator('.boot-loader-runner');
      assert.equal(await bootRunner.evaluate(el => getComputedStyle(el).animationIterationCount),'infinite');
      assert.equal(await bootRunner.evaluate(el => el.getAnimations()[0]?.playState),'running');
      const runnerBefore=await bootRunner.evaluate(el => getComputedStyle(el).left);
      await wait(120);
      const runnerAfter=await bootRunner.evaluate(el => getComputedStyle(el).left);
      assert.notEqual(runnerAfter,runnerBefore);
      await startup.waitForFunction(() => !document.documentElement.classList.contains('boot-enabled'),null,{timeout:10000});
      assert.ok(await startup.locator('.hero').evaluate(el => el.classList.contains('hero-booting')));
      assert.equal(await startup.locator('html').getAttribute('data-app-state'),'inactive');
      assert.equal(await startup.locator('[data-task="top"]').evaluate(el => el.classList.contains('is-active')),false);
      assert.equal(await startup.locator('.profile-window').evaluate(el => getComputedStyle(el).visibility),'hidden');
      await startup.waitForFunction(() => document.documentElement.dataset.appState === 'launching',null,{timeout:5000});
      assert.ok(await startup.locator('[data-task="top"]').evaluate(el => el.classList.contains('is-app-launching')));
      assert.equal(await startup.locator('.profile-window').evaluate(el => getComputedStyle(el).visibility),'visible');
      await startup.waitForFunction(() => document.querySelector('.hero').classList.contains('hero-ready'),null,{timeout:5000});
      assert.deepEqual(await startup.evaluate(() => window.__appStateHistory.filter((value,index,list) => list.indexOf(value) === index)),['inactive','hover','pressed','launching','active']);
      assert.equal(await startup.locator('.system-notification').count(),0);
      await startup.evaluate(() => scrollTo({top:430,behavior:'instant'}));
      await wait(100);
      assert.notEqual(await startup.locator('.profile-window').evaluate(el => getComputedStyle(el).scale),'none');
      assert.ok(await startup.locator('[data-task="work"]').evaluate(el => el.classList.contains('is-minimize-target')));
      await startup.reload({waitUntil:'domcontentloaded'});
      assert.ok(await startup.locator('html').evaluate(el => !el.classList.contains('boot-enabled')));
      const replay = await startupContext.newPage();
      await replay.goto(`${BASE}?replay=1`,{waitUntil:'domcontentloaded'});
      await skipStartup(replay);
      await replay.evaluate(() => scrollTo({top:0,behavior:'instant'}));
      await wait(100);
      await replay.reload({waitUntil:'domcontentloaded'});
      assert.ok(await replay.locator('html').evaluate(el => el.classList.contains('boot-enabled')));
      await replay.locator('.boot-skip').click();
      const skipped = await startupContext.newPage();
      await skipped.goto(BASE,{waitUntil:'domcontentloaded'});
      await skipped.locator('.boot-skip').focus();
      await skipped.keyboard.press('Enter');
      await skipped.waitForFunction(() => document.querySelector('.hero').classList.contains('hero-ready'));
      assert.ok(await skipped.locator('.system-boot').isHidden());
      await startupContext.close();
    });
    await test('XP taskbar, Start keyboard navigation and motion preferences', async () => {
      const ui = await browser.newPage({viewport:{width:390,height:844}});
      await ui.goto(BASE);
      await skipStartup(ui);
      for (const id of ['work','skills','about','contact']) {
        assert.ok(await ui.locator(`[data-task="${id}"]`).isVisible());
        await ui.locator(`[data-task="${id}"]`).click();
        await ui.waitForFunction(id => document.querySelector(`[data-task="${id}"]`).getAttribute('aria-current') === 'location', id);
      }
      assert.ok(await ui.locator('.topbar nav').isHidden());
      assert.ok(await ui.locator('#startToggle').isHidden());
      await ui.locator('#motionToggle').evaluate(el => el.click());
      assert.equal(await ui.locator('html').getAttribute('data-motion'), 'paused');
      await ui.reload();
      assert.equal(await ui.locator('html').getAttribute('data-motion'), 'paused');
      await ui.close();

      const desktopUi = await browser.newPage({viewport:{width:1000,height:844}});
      await desktopUi.goto(BASE);
      await skipStartup(desktopUi);
      await desktopUi.locator('#startToggle').click();
      await desktopUi.locator('#startPanel a[href="#about"]').click();
      await desktopUi.waitForFunction(() => document.activeElement.id === 'about');
      assert.ok(await desktopUi.locator('#startPanel').isHidden());
      await desktopUi.locator('#startToggle').focus(); await desktopUi.keyboard.press('ArrowUp');
      assert.ok(await desktopUi.locator('#startPanel').isVisible());
      await desktopUi.keyboard.press('Escape');
      assert.equal(await desktopUi.evaluate(() => document.activeElement.id), 'startToggle');
      await desktopUi.close();
    });
    await test('reload restores the exact reading position', async () => {
      const reading = await browser.newPage({viewport:{width:390,height:844}});
      await reading.goto(BASE);
      await skipStartup(reading);
      await reading.locator('#ocr').evaluate(element => {
        element.scrollIntoView({behavior:'instant', block:'start'});
        scrollBy({top:137, behavior:'instant'});
      });
      await wait(120);
      const before = await reading.evaluate(() => scrollY);
      await reading.reload({waitUntil:'load'});
      await reading.waitForFunction(expected => Math.abs(scrollY - expected) <= 2, before);
      assert.ok(before > 0);
      await reading.close();
    });
    await test('contact methods have the requested order and destinations', async () => {
      const channels = await page.locator('.contact-channels a').evaluateAll(links => links.map(link => ({
        text: link.textContent.trim().replace(/\s+/g, ' '), href: link.href
      })));
      assert.deepEqual(channels.map(channel => channel.text), ['01 Telegram', '02 MAX', '03 ВКонтакте']);
      assert.equal(new URL(channels[0].href).hostname, 't.me');
      assert.equal(new URL(channels[1].href).hostname, 'max.ru');
      assert.equal(new URL(channels[2].href).hostname, 'vk.ru');
      assert.equal(await page.locator('.contact-email').getAttribute('href'), 'mailto:g.belyaev@innopolis.university');
    });
    await test('no uncaught JavaScript errors',async()=>assert.deepEqual(errors,[]));
  } finally { await browser.close(); }
  if (failures.length) {console.error(`Failed: ${failures.join(', ')}`);process.exitCode=1;}
})();
