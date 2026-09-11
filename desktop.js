/* Desktop-inspired shortcuts; the document stays usable without this enhancement. */
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const motionAllowed = () => !reduced.matches && root.dataset.motion !== 'paused';
  const start = document.querySelector('#startToggle');
  const panel = document.querySelector('#startPanel');
  let menuAnimation;
  if (start && panel) {
    start.hidden = false;
    const setOpen = (open, returnFocus = false) => {
      menuAnimation?.cancel();
      panel.hidden = !open;
      start.setAttribute('aria-expanded', String(open));
      if (open && motionAllowed() && panel.animate) {
        menuAnimation = panel.animate([
          { opacity: 0, translate: '0 10px', scale: '.98' },
          { opacity: 1, translate: '0 0', scale: '1' }
        ], { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
      if (returnFocus) start.focus({ preventScroll: true });
    };
    start.addEventListener('click', () => setOpen(panel.hidden));
    start.addEventListener('keydown', event => {
      if (event.key !== 'ArrowUp') return;
      event.preventDefault();
      setOpen(true);
      panel.querySelector('a')?.focus();
    });
    panel.addEventListener('click', event => {
      const link = event.target.closest('a');
      if (!link) return;
      setOpen(false);
      if (link.hash) {
        const target = document.getElementById(link.hash.slice(1));
        if (target) {
          if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }
      }
    });
    document.addEventListener('pointerdown', event => {
      if (!panel.hidden && !panel.contains(event.target) && !start.contains(event.target)) setOpen(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !panel.hidden) { setOpen(false, true); event.preventDefault(); }
    });
    document.addEventListener('focusin', event => {
      if (!panel.hidden && !panel.contains(event.target) && !start.contains(event.target)) setOpen(false);
    });
    document.addEventListener('portfolio:motion-change', () => { if (!motionAllowed()) menuAnimation?.cancel(); });
  }

  const tasks = [...document.querySelectorAll('[data-task]')];
  const sections = [...document.querySelectorAll('main > section')];
  let navFrame = 0;
  const updateActive = () => {
    navFrame = 0;
    const guide = innerHeight * .38;
    let active = 'top';
    sections.forEach(section => {
      if (section.getBoundingClientRect().top <= guide) active = section.id || 'top';
    });
    if (scrollY > 0 && scrollY + innerHeight >= document.documentElement.scrollHeight - 4) active = 'contact';
    tasks.forEach(link => {
      const current = link.dataset.task === active;
      link.classList.toggle('is-active', current);
      if (current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };
  const schedule = () => { if (!navFrame) navFrame = requestAnimationFrame(updateActive); };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  addEventListener('load', schedule);
  new ResizeObserver(schedule).observe(document.body);
  schedule();

  const living = document.querySelectorAll('.workflow-window');
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    entry.target.classList.toggle('is-in-view', entry.isIntersecting);
  }));
  living.forEach(element => observer.observe(element));

  const copy = document.querySelector('#copyEmail');
  const status = document.querySelector('#copyStatus');
  if (copy && status && navigator.clipboard?.writeText) {
    copy.hidden = false;
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText('g.belyaev@innopolis.university');
        status.textContent = 'Адрес скопирован. До встречи в почте!';
      } catch {
        status.textContent = 'Не получилось скопировать. Адрес можно выделить выше.';
      }
    });
  }
})();
