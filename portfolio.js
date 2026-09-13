/* Progressive enhancement: content, project links and skill lists work without JS. */
(() => {
  const navigation = performance.getEntriesByType?.('navigation')[0];
  const isReload = navigation?.type === 'reload' || performance.navigation?.type === 1;
  const scrollKey = `portfolio-scroll:${location.pathname}${location.search}`;
  const scrollAnchors = [...document.querySelectorAll('main > section[id], article[id], #demo, #skillGroups')];
  let savedScroll;
  try { savedScroll = JSON.parse(sessionStorage.getItem(scrollKey)); } catch {}
  const layoutTop = element => {
    let top = 0;
    for (let node = element; node; node = node.offsetParent) top += node.offsetTop;
    return top;
  };

  const captureScroll = () => {
    let anchor;
    let anchorTop = -Infinity;
    for (const element of scrollAnchors) {
      const top = layoutTop(element);
      if (top <= scrollY + 8 && top > anchorTop) { anchor = element; anchorTop = top; }
    }
    const state = {
      y: scrollY,
      anchor: anchor?.id || '',
      offset: anchor ? scrollY - anchorTop : 0
    };
    try { sessionStorage.setItem(scrollKey, JSON.stringify(state)); } catch {}
  };

  let saveFrame = 0;
  addEventListener('scroll', () => {
    if (saveFrame) return;
    saveFrame = requestAnimationFrame(() => { saveFrame = 0; captureScroll(); });
  }, { passive: true });
  addEventListener('pagehide', captureScroll);

  if (isReload && savedScroll && Number.isFinite(savedScroll.y)) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const restoreScroll = () => {
      const anchor = savedScroll.anchor && document.getElementById(savedScroll.anchor);
      const target = anchor
        ? layoutTop(anchor) + Number(savedScroll.offset || 0)
        : savedScroll.y;
      const limit = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      scrollTo({ top: Math.max(0, Math.min(target, limit)), behavior: 'instant' });
    };
    addEventListener('load', () => requestAnimationFrame(() => requestAnimationFrame(restoreScroll)), { once: true });
  }

  const clock = document.querySelector('#metaClock');
  if (clock) {
    const formatter = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    const update = () => {
      const time = formatter.format(new Date());
      clock.textContent = `${time} МСК`;
      const taskClock = document.querySelector('#taskClock');
      if (taskClock) taskClock.textContent = time;
    };
    update();
    setInterval(() => { if (!document.hidden) update(); }, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
  }

  const controls = document.querySelector('#riskControls');
  if (controls) {
    const inputs = ['rule', 'ml', 'weight'].map(name => document.querySelector(`#${name}Range`));
    const outputs = ['rule', 'ml', 'weight'].map(name => document.querySelector(`#${name}Output`));
    const score = document.querySelector('#riskScore');
    const level = document.querySelector('#riskLevel');
    const explanation = document.querySelector('#riskExplanation');
    const announcement = document.querySelector('#riskAnnouncement');
    // Match Python's round(): ties go to the nearest even integer.
    const roundEven = value => {
      const floor = Math.floor(value);
      return value - floor === 0.5 ? floor + (floor % 2) : Math.round(value);
    };
    const update = (announce = false) => {
      const [rule, ml, weight] = inputs.map(input => Math.max(0, Math.min(100, Number(input.value))));
      const blended = roundEven((rule * (100 - weight) + ml * weight) / 100);
      const effective = Math.max(blended, rule);
      const risk = effective <= 20 ? ['low', 'Низкий'] : effective <= 54 ? ['medium', 'Средний'] : ['high', 'Высокий'];
      [rule, ml, `${weight}%`].forEach((value, i) => { outputs[i].value = String(value); });
      score.value = String(effective);
      level.textContent = risk[1];
      level.dataset.level = risk[0];
      explanation.textContent = `Смесь: ${blended} · по правилам: ${rule} → итог: ${effective}`;
      if (announce) announcement.textContent = `Оценка ${effective} из 100. ${risk[1]} уровень риска.`;
    };
    inputs.forEach(input => {
      input.addEventListener('input', () => update());
      input.addEventListener('change', () => update(true));
    });
    controls.disabled = false;
    update();
  }

  const progress = document.querySelector('.scroll-progress span');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const motionToggle = document.querySelector('#motionToggle');
  let motionPaused = false;
  try { motionPaused = localStorage.getItem('portfolio-motion') === 'paused'; } catch {}
  const syncMotion = () => {
    const paused = motionPaused || reducedMotion.matches;
    root.dataset.motion = paused ? 'paused' : 'running';
    if (motionToggle) {
      motionToggle.hidden = false;
      motionToggle.disabled = reducedMotion.matches;
      motionToggle.setAttribute('aria-pressed', String(paused));
      motionToggle.textContent = reducedMotion.matches ? 'Движение уменьшено' : paused ? 'Анимации: выкл' : 'Анимации: вкл';
      motionToggle.setAttribute('aria-label', paused ? 'Включить анимации' : 'Отключить анимации');
    }
    document.dispatchEvent(new Event('portfolio:motion-change'));
  };
  motionToggle?.addEventListener('click', () => {
    motionPaused = !motionPaused;
    try { localStorage.setItem('portfolio-motion', motionPaused ? 'paused' : 'running'); } catch {}
    syncMotion();
  });
  reducedMotion.addEventListener('change', syncMotion);
  syncMotion();
  const syncVisibility = () => { root.dataset.pageHidden = String(document.hidden); };
  document.addEventListener('visibilitychange', syncVisibility);
  syncVisibility();
  if ('IntersectionObserver' in window) {
    const hero = document.querySelector('.hero');
    if (hero) new IntersectionObserver(([entry]) => {
      root.dataset.heroVisible = String(entry.isIntersecting);
    }).observe(hero);
  }
  if (progress) {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (reducedMotion.matches) return;
      const height = document.documentElement.scrollHeight - innerHeight;
      progress.style.transform = `scaleX(${height > 0 ? Math.max(0, Math.min(1, scrollY / height)) : 0})`;
    };
    const schedule = () => { if (!frame && !reducedMotion.matches) frame = requestAnimationFrame(update); };
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule);
    addEventListener('load', schedule);
    reducedMotion.addEventListener('change', schedule);
    if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(document.body);
    schedule();
  }

  // Dense desktop tools remain available on phones through native disclosures.
  // With JavaScript disabled they stay open, so no portfolio content disappears.
  const compactLayout = matchMedia('(max-width: 600px)');
  const disclosures = [...document.querySelectorAll('.mobile-disclosure')];
  const disclosureState = new WeakMap();
  const hashTarget = () => {
    try { return document.getElementById(decodeURIComponent(location.hash.slice(1))); }
    catch { return null; }
  };
  const syncDisclosures = () => disclosures.forEach(details => {
    const state = disclosureState.get(details) || { userSet: false, syncing: false };
    disclosureState.set(details, state);
    const target = hashTarget();
    const containsTarget = target && (target === details || details.contains(target));
    const shouldOpen = !compactLayout.matches || state.userSet || containsTarget;
    if (details.open === shouldOpen) return;
    state.syncing = true;
    details.open = shouldOpen;
    setTimeout(() => { state.syncing = false; });
  });
  disclosures.forEach(details => details.addEventListener('toggle', () => {
    const state = disclosureState.get(details);
    if (compactLayout.matches && state && !state.syncing) state.userSet = details.open;
  }));
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    let target;
    try { target = document.getElementById(decodeURIComponent(link.hash.slice(1))); }
    catch { return; }
    const details = target?.closest('.mobile-disclosure');
    if (details) {
      const state = disclosureState.get(details);
      if (state) state.userSet = true;
      details.open = true;
    }
  });
  addEventListener('hashchange', syncDisclosures);
  compactLayout.addEventListener('change', syncDisclosures);
  syncDisclosures();

  const stage = document.querySelector('#skills3d');
  if (stage) {
    let loaded = false;
    const load = async () => {
      if (loaded) return;
      loaded = true;
      try {
        const { initSphere } = await import('./skills-3d.js?v=20260914-1');
        initSphere(stage);
      } catch (error) {
        document.querySelector('#sphereStatus').textContent = '3D-карта недоступна. Все технологии и ссылки на проекты есть в списке ниже.';
        stage.classList.add('is-unavailable');
        stage.removeAttribute('tabindex');
        stage.setAttribute('aria-label', '3D-карта недоступна');
        console.warn('Не удалось загрузить карту технологий:', error);
      }
    };
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); }
      }, { rootMargin: '1000px 0px' });
      observer.observe(stage);
    } else load();
  }
})();
