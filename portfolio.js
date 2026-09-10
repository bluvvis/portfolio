/* Progressive enhancement: content, project links and skill lists work without JS. */
(() => {
  const clock = document.querySelector('#metaClock');
  if (clock) {
    const formatter = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    const update = () => { clock.textContent = `${formatter.format(new Date())} МСК`; };
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
  // Animate on entry, without CSS that could leave content hidden if JS fails.
  if ('IntersectionObserver' in window && Element.prototype.animate) {
    const running = new Set();
    const reveal = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        reveal.unobserve(entry.target);
        if (root.dataset.motion === 'paused' || entry.target.contains(document.activeElement)) return;
        const isText = entry.target.matches('h1, .hero-usp, .hero-intro, .section-heading');
        const animation = entry.target.animate([
          { opacity: isText ? 0.25 : 0, translate: isText ? '0 10px' : '0 22px' },
          { opacity: 1, translate: '0 0' }
        ], { duration: isText ? 500 : 650, easing: 'cubic-bezier(.2,.7,.2,1)' });
        running.add(animation);
        animation.finished.catch(() => {}).finally(() => running.delete(animation));
      });
    }, { threshold: 0.06 });
    document.querySelectorAll('.hero-name, .hero h1, .hero-usp, .hero-intro, .hero .actions, .hero-portrait, .section-heading, .feature-title, .feature-grid, .architecture, .risk-demo, .project-card, .skills-explorer, .skill-groups, .about-grid, .contact-main').forEach(element => reveal.observe(element));
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) running.forEach(animation => animation.cancel());
    });
    document.addEventListener('portfolio:motion-change', () => {
      if (root.dataset.motion === 'paused') running.forEach(animation => animation.cancel());
    });
    document.addEventListener('focusin', event => {
      running.forEach(animation => {
        if (animation.effect.target.contains(event.target)) animation.finish();
      });
    });
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

  const stage = document.querySelector('#skills3d');
  if (stage) {
    let loaded = false;
    const load = async () => {
      if (loaded) return;
      loaded = true;
      try {
        const { initSphere } = await import('./skills-3d.js');
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
      }, { rootMargin: '300px' });
      observer.observe(stage);
    } else load();
  }
})();
