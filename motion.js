/* The desktop assembles in view. The underlying document is always complete. */
;(() => {
	if (!Element.prototype.animate || !('IntersectionObserver' in window)) return
	const root = document.documentElement
	const reduced = matchMedia('(prefers-reduced-motion: reduce)')
	const fine = matchMedia('(hover: hover) and (pointer: fine)')
	const allowed = () =>
		root.dataset.motion !== 'paused' && !reduced.matches && !document.hidden
	const running = new Set()
	const finishTyping = new Set()
	const play = (element, frames, options = {}) => {
		if (!allowed()) return
		const animation = element.animate(frames, {
			duration: 850,
			easing: 'cubic-bezier(.16,1,.3,1)',
			...options,
		})
		running.add(animation)
		animation.finished.catch(() => {}).finally(() => running.delete(animation))
		return animation
	}
	const cancel = () => {
		if (!allowed()) {
			running.forEach(animation => animation.cancel())
			finishTyping.forEach(finish => finish())
			document
				.querySelectorAll('.scene-entering')
				.forEach(element => element.classList.remove('scene-entering'))
		}
	}
	document.addEventListener('portfolio:motion-change', cancel)
	document.addEventListener('visibilitychange', cancel)
	reduced.addEventListener('change', cancel)
	const finishFor = target =>
		running.forEach(animation => {
			if (animation.effect.target.contains(target)) animation.finish()
		})
	document.addEventListener('focusin', event => finishFor(event.target))
	const revealDestination = () => {
		let id
		try {
			id = decodeURIComponent(location.hash.slice(1))
		} catch {
			return
		}
		const target = document.getElementById(id)
		if (target) finishFor(target)
	}
	addEventListener('hashchange', revealDestination)
	document.addEventListener('pointerdown', event => finishFor(event.target), {
		passive: true,
	})

	const hero = document.querySelector('.hero')
	const bootScreen = document.querySelector('.system-boot')
	const appTask = document.querySelector('[data-task="top"]')
	let bootPending = root.classList.contains('boot-enabled')
	let startupActive = bootPending
	let startupSkipped = false
	let heroStarted = false
	let heroReadyTimer
	const bootTimers = new Set()
	const stageTimers = new Set()
	const timed = (set, callback, delay) => {
		const timer = setTimeout(() => {
			set.delete(timer)
			callback()
		}, delay)
		set.add(timer)
		return timer
	}
	const bootLater = (callback, delay) => timed(bootTimers, callback, delay)
	const stageLater = (callback, delay) => timed(stageTimers, callback, delay)
	const clearTimers = set => {
		set.forEach(clearTimeout)
		set.clear()
	}
	const setBootState = state => {
		root.dataset.bootState = state
	}
	const showPost = name =>
		bootScreen
			?.querySelector(`[data-post="${name}"]`)
			?.classList.add('is-visible')
	const showComponent = name =>
		bootScreen
			?.querySelector(`[data-component="${name}"]`)
			?.classList.add('is-visible')
	const clearCursor = () => {
		document
			.querySelector('.demo-cursor')
			?.classList.remove('is-visible', 'is-clicking')
		appTask?.classList.remove('is-demo-pressed')
	}
	const clearDemo = () => {
		clearTimers(stageTimers)
		clearCursor()
		document
			.querySelector('.system-notification')
			?.classList.remove('is-visible', 'is-leaving')
		appTask?.classList.remove('is-app-launching', 'is-demo-pressed')
	}
	const animateStage = (
		selector,
		frames,
		delay = 0,
		duration = 400,
		easing = 'cubic-bezier(.2,.72,.22,1)',
	) => {
		const element = document.querySelector(selector)
		if (!element) return
		return play(element, frames, { delay, duration, easing, fill: 'backwards' })
	}
	const inactiveStates = new Set(['inactive', 'hover', 'pressed'])
	const keepAppInactive = () => {
		if (!appTask || !inactiveStates.has(root.dataset.appState)) return
		if (
			appTask.classList.contains('is-active') ||
			appTask.classList.contains('is-app-launching')
		) {
			appTask.classList.remove('is-active', 'is-app-launching')
		}
		if (appTask.hasAttribute('aria-current'))
			appTask.removeAttribute('aria-current')
	}
	const appStateObserver = appTask
		? new MutationObserver(keepAppInactive)
		: null
	if (bootPending && appTask) {
		appStateObserver.observe(appTask, {
			attributes: true,
			attributeFilter: ['class', 'aria-current'],
		})
		keepAppInactive()
	}
	const markHeroReady = (announce = false) => {
		startupActive = false
		root.dataset.appState = 'active'
		hero?.classList.remove('hero-booting')
		hero?.classList.add('hero-ready')
		root.classList.add('hero-ready')
		appTask?.classList.remove('is-app-launching', 'is-demo-pressed')
		if (announce) {
			const notification = document.querySelector('.system-notification')
			notification?.classList.add('is-visible')
			stageLater(() => notification?.classList.add('is-leaving'), 680)
			stageLater(
				() => notification?.classList.remove('is-visible', 'is-leaving'),
				860,
			)
		}
		scheduleHeroExit()
	}
	const launchMainApp = () => {
		if (!hero || !startupActive) return
		const slower = value => Math.round(value / 0.65)
		const animateApp = (selector, frames, delay, duration, easing) =>
			animateStage(selector, frames, slower(delay), slower(duration), easing)
		const profile = document.querySelector('.profile-window')
		const taskRect = appTask?.getBoundingClientRect()
		const profileRect = profile?.getBoundingClientRect()
		const launchX =
			taskRect && profileRect
				? taskRect.left +
					taskRect.width * 0.5 -
					(profileRect.left + profileRect.width * 0.15)
				: -220
		const launchY =
			taskRect && profileRect
				? taskRect.top +
					taskRect.height * 0.5 -
					(profileRect.top + profileRect.height)
				: 420
		animateApp(
			'.profile-window',
			[
				{
					visibility: 'visible',
					translate: `${launchX}px ${launchY}px`,
					scale: '.04 .025',
					clipPath: 'inset(0 0 94% 0)',
					transformOrigin: '15% 100%',
				},
				{
					visibility: 'visible',
					translate: '0 -7px',
					scale: '1.022 1.03',
					clipPath: 'inset(0)',
					transformOrigin: '15% 100%',
					offset: 0.84,
				},
				{
					visibility: 'visible',
					translate: '0 0',
					scale: '1',
					clipPath: 'inset(0)',
					transformOrigin: '15% 100%',
				},
			],
			0,
			1050,
			'cubic-bezier(.17,.76,.18,1.04)',
		)
		animateApp(
			'.profile-window > .xp-titlebar',
			[{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0)' }],
			100,
			350,
			'steps(10,end)',
		)
		animateApp(
			'.hero-copy',
			[{ opacity: 0 }, { opacity: 1 }],
			860,
			90,
			'steps(2,end)',
		)
		animateApp(
			'.hero-name',
			[{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0)' }],
			920,
			230,
			'steps(10,end)',
		)
		animateApp(
			'.hero-title-line:first-child',
			[
				{ clipPath: 'inset(0 100% 0 0)', translate: '-32px 0' },
				{ clipPath: 'inset(0)', translate: '0 0' },
			],
			1010,
			470,
			'cubic-bezier(.12,.72,.16,1)',
		)
		animateApp(
			'.hero-title-line-accent',
			[
				{ clipPath: 'inset(0 0 0 100%)', translate: '28px 0' },
				{ clipPath: 'inset(0)', translate: '0 0' },
			],
			1230,
			390,
			'cubic-bezier(.12,.72,.16,1)',
		)
		animateApp(
			'.hero-usp',
			[
				{ visibility: 'hidden', translate: '0 12px' },
				{ visibility: 'visible', translate: '0 0' },
			],
			1440,
			270,
		)
		animateApp(
			'.hero-intro',
			[{ visibility: 'hidden' }, { visibility: 'visible' }],
			1530,
			1,
			'steps(1,end)',
		)
		animateApp(
			'.hero .actions',
			[
				{ visibility: 'hidden', translate: '0 10px' },
				{ visibility: 'visible', translate: '0 0' },
			],
			1580,
			260,
		)
		animateApp(
			'.xp-statusbar',
			[{ visibility: 'hidden' }, { visibility: 'visible' }],
			1660,
			1,
			'steps(1,end)',
		)
		animateApp(
			'.hero-portrait',
			[
				{
					visibility: 'hidden',
					clipPath: 'inset(0 0 98% 0)',
					translate: '20px 12px',
					scale: '.95',
				},
				{
					visibility: 'visible',
					clipPath: 'inset(0)',
					translate: '0 0',
					scale: '1',
				},
			],
			1760,
			650,
			'cubic-bezier(.18,.78,.22,1)',
		)
		animateApp(
			'.workflow-window',
			[
				{
					visibility: 'hidden',
					clipPath: 'inset(0 100% 0 0)',
					translate: '28px 0',
				},
				{ visibility: 'visible', clipPath: 'inset(0)', translate: '0 0' },
			],
			2110,
			520,
			'steps(14,end)',
		)
		stageLater(
			() => document.dispatchEvent(new Event('portfolio:terminal-start')),
			slower(2220),
		)
		animateApp(
			'.hero-foot',
			[{ visibility: 'hidden' }, { visibility: 'visible' }],
			2220,
			1,
			'steps(1,end)',
		)
		heroReadyTimer = setTimeout(() => {
			root.classList.remove('desktop-starting')
			markHeroReady(true)
		}, slower(2800))
	}
	const activateApp = () => {
		if (
			!startupActive ||
			!appTask ||
			root.dataset.appState === 'launching' ||
			root.dataset.appState === 'active'
		)
			return
		root.dataset.appState = 'pressed'
		appTask.classList.add('is-demo-pressed')
		stageLater(() => {
			if (!startupActive) return
			root.dataset.appState = 'launching'
			appStateObserver?.disconnect()
			appTask.classList.remove('is-demo-pressed')
			appTask.classList.add('is-active', 'is-app-launching')
			appTask.setAttribute('aria-current', 'location')
			launchMainApp()
		}, 140)
	}
	const runCursorLaunch = () => {
		const cursor = document.querySelector('.demo-cursor')
		if (
			!cursor ||
			!appTask ||
			!allowed() ||
			!fine.matches ||
			innerWidth < 821
		) {
			root.dataset.appState = 'hover'
			stageLater(activateApp, 230)
			return
		}
		const rect = appTask.getBoundingClientRect()
		const startX = innerWidth * 0.57
		const startY = innerHeight * 0.46
		const targetX = rect.left + Math.min(rect.width * 0.55, 74)
		const targetY = rect.top + rect.height * 0.48
		cursor.classList.add('is-visible')
		cursor.style.translate = `${startX}px ${startY}px`
		stageLater(() => {
			if (!startupActive) return
			const travel = play(
				cursor,
				[
					{ translate: `${startX}px ${startY}px`, rotate: '-3deg' },
					{
						translate: `${startX - 24}px ${startY + 18}px`,
						rotate: '2deg',
						offset: 0.26,
					},
					{ translate: `${targetX}px ${targetY}px`, rotate: '0deg' },
				],
				{
					duration: 650,
					easing: 'cubic-bezier(.32,.02,.18,1)',
					fill: 'forwards',
				},
			)
			travel?.finished
				.then(() => {
					if (!startupActive || !allowed()) return clearCursor()
					root.dataset.appState = 'hover'
					stageLater(() => {
						if (!startupActive) return
						cursor.classList.add('is-clicking')
						activateApp()
					}, 120)
					stageLater(() => {
						cursor.classList.remove('is-clicking')
						const exit = play(
							cursor,
							[
								{ translate: `${targetX}px ${targetY}px`, opacity: 1 },
								{
									translate: `${targetX + 75}px ${targetY - 22}px`,
									opacity: 0,
								},
							],
							{ duration: 280, easing: 'steps(7,end)', fill: 'forwards' },
						)
						exit?.finished.finally(() => cursor.classList.remove('is-visible'))
					}, 330)
				})
				.catch(clearCursor)
		}, 150)
	}
	const startHero = () => {
		if (bootPending || heroStarted || !hero || !allowed()) return
		heroStarted = true
		startupActive = true
		root.dataset.appState = 'inactive'
		hero.classList.add('hero-booting')
		root.classList.add('desktop-starting')
		animateStage(
			'.xp-taskbar',
			[
				{ translate: '0 115%' },
				{ translate: '0 -4px', offset: 0.82 },
				{ translate: '0 0' },
			],
			250,
			500,
			'cubic-bezier(.2,.75,.2,1)',
		)
		animateStage(
			'.topbar',
			[{ clipPath: 'inset(0 50% 100%)' }, { clipPath: 'inset(0)' }],
			330,
			340,
			'steps(8,end)',
		)
		animateStage(
			'.hero-banner',
			[{ visibility: 'hidden' }, { visibility: 'visible' }],
			580,
			1,
			'steps(1,end)',
		)
		document
			.querySelectorAll('.desktop-shortcuts a')
			.forEach((shortcut, index) => {
				play(
					shortcut,
					[
						{ visibility: 'hidden', translate: '0 8px', scale: '.82' },
						{
							visibility: 'visible',
							translate: '0 -2px',
							scale: '1.04',
							offset: 0.72,
						},
						{ visibility: 'visible', translate: '0 0', scale: '1' },
					],
					{
						delay: 800 + index * 80,
						duration: 340,
						easing: 'cubic-bezier(.2,.7,.2,1.15)',
						fill: 'backwards',
					},
				)
			})
		animateStage(
			'[data-task="top"]',
			[{ visibility: 'hidden' }, { visibility: 'visible' }],
			710,
			1,
			'steps(1,end)',
		)
		stageLater(runCursorLaunch, 1900)
	}
	const removeBoot = () => {
		bootPending = false
		clearTimers(bootTimers)
		clearTimeout(window.__portfolioBootFallback)
		root.classList.remove('boot-enabled', 'boot-pulse')
		root.removeAttribute('data-boot-state')
	}
	const beginDesktop = () => {
		if (!bootPending) return
		removeBoot()
		startHero()
	}
	const finishStartup = () => {
		if (!startupActive && !bootPending) return
		startupSkipped = true
		removeBoot()
		clearTimeout(heroReadyTimer)
		clearDemo()
		running.forEach(animation => {
			const target = animation.effect?.target
			if (
				target &&
				(hero?.contains(target) || target.closest?.('.xp-taskbar, .topbar'))
			)
				animation.cancel()
		})
		heroStarted = true
		appStateObserver?.disconnect()
		root.dataset.appState = 'active'
		root.classList.remove('desktop-starting')
		markHeroReady(false)
	}
	const runBoot = () => {
		const origin = Number(window.__portfolioBootStartedAt) || performance.now()
		const at = (callback, targetTime) =>
			bootLater(
				callback,
				Math.max(0, targetTime - (performance.now() - origin)),
			)
		setBootState('black')
		at(() => {
			setBootState('post')
			showPost('brand')
		}, 500)
		at(() => showPost('cpu'), 750)
		at(() => showPost('memory'), 1000)
		const memory = bootScreen?.querySelector('[data-memory-value]')
		const memoryStatus = bootScreen?.querySelector('[data-memory-status]')
		at(() => {
			if (memory) memory.textContent = '4096K'
		}, 1170)
		at(() => {
			if (memory) memory.textContent = '8192K'
		}, 1360)
		at(() => {
			if (memory) memory.textContent = '16384K'
			if (memoryStatus) memoryStatus.textContent = 'OK'
		}, 1550)
		at(() => showPost('gpu'), 1770)
		at(() => showPost('storage'), 2010)
		at(() => showPost('network'), 2250)
		at(() => showPost('audio'), 2470)
		at(() => {
			const display = bootScreen?.querySelector('[data-display-mode]')
			if (display) display.textContent = `${screen.width}x${screen.height} OK`
			showPost('display')
		}, 2700)
		at(() => showPost('input'), 2950)
		at(() => showPost('hardware-ready'), 3250)
		at(() => root.classList.add('boot-pulse'), 3350)
		at(() => {
			root.classList.remove('boot-pulse')
			setBootState('components')
		}, 3500)
		;[
			'kernel',
			'shell',
			'windows',
			'taskbar',
			'desktop',
			'portfolio',
			'ml',
			'three',
			'projects',
			'profile',
			'user',
			'starting',
		].forEach((name, index) => {
			at(() => showComponent(name), 3630 + index * 130)
		})
		at(() => setBootState('blackout'), 5250)
		at(() => setBootState('xp'), 5650)
		at(() => setBootState('shell-blackout'), 8250)
		at(() => setBootState('video'), 8500)
		at(() => setBootState('flash'), 8750)
		at(beginDesktop, 8800)
	}
	const skipButton = bootScreen?.querySelector('.boot-skip')
	const skipKey = event => {
		if (!startupActive || event.key !== 'Escape') return
		event.preventDefault()
		finishStartup()
	}
	skipButton?.addEventListener('click', finishStartup)
	document.addEventListener('keydown', skipKey, { capture: true })
	if (bootPending && bootScreen) runBoot()
	else {
		root.classList.remove('boot-enabled')
		root.removeAttribute('data-boot-state')
		clearTimeout(window.__portfolioBootFallback)
	}
	if (!bootPending)
		setTimeout(() => {
			startupSkipped = true
			heroStarted = true
			root.dataset.appState = 'active'
			hero?.classList.add('hero-ready')
			root.classList.add('hero-ready')
			scheduleHeroExit()
		})
	const profileWindow = hero?.querySelector('.profile-window')
	const heroSide = hero?.querySelector('.desktop-side')
	const heroShortcuts = hero?.querySelector('.desktop-shortcuts')
	const projectTask = document.querySelector('[data-task="work"]')
	let heroBase
	let heroExitFrame = 0
	const resetHeroExit = () => {
		;[profileWindow, heroSide, heroShortcuts].forEach(element => {
			if (!element) return
			element.style.removeProperty('translate')
			element.style.removeProperty('scale')
			element.style.removeProperty('opacity')
		})
		projectTask?.classList.remove('is-minimize-target')
	}
	const updateHeroExit = () => {
		heroExitFrame = 0
		if (
			!hero?.classList.contains('hero-ready') ||
			!profileWindow ||
			!projectTask ||
			!allowed()
		) {
			resetHeroExit()
			return
		}
		const distance = Math.max(320, Math.min(innerHeight * 0.72, 700))
		const progress = Math.max(0, Math.min(1, (scrollY - 20) / distance))
		if (progress <= 0) {
			resetHeroExit()
			return
		}
		if (!heroBase) {
			const rect = profileWindow.getBoundingClientRect()
			heroBase = {
				left: rect.left,
				top: rect.top + scrollY,
				width: rect.width,
				height: rect.height,
			}
		}
		const target = projectTask.getBoundingClientRect()
		const originX = heroBase.left + heroBase.width * 0.15
		const originY = heroBase.top - scrollY + heroBase.height
		const targetX = target.left + target.width * 0.5
		const targetY = target.top + target.height * 0.5
		const eased = progress * progress * (3 - 2 * progress)
		profileWindow.style.translate = `${(targetX - originX) * eased}px ${(targetY - originY) * eased}px`
		profileWindow.style.scale = String(1 - eased * 0.91)
		profileWindow.style.opacity = String(
			progress < 0.7 ? 1 : Math.max(0, 1 - (progress - 0.7) / 0.3),
		)
		if (heroSide) {
			heroSide.style.translate = `${innerWidth > 820 ? progress * 34 : 0}px ${progress * 90}px`
			heroSide.style.scale = String(1 - progress * 0.12)
			heroSide.style.opacity = String(Math.max(0, 1 - progress * 1.35))
		}
		if (heroShortcuts) {
			heroShortcuts.style.translate = `${-progress * 24}px 0`
			heroShortcuts.style.opacity = String(Math.max(0, 1 - progress * 1.5))
		}
		projectTask.classList.toggle(
			'is-minimize-target',
			progress > 0.58 && progress < 1,
		)
	}
	const scheduleHeroExit = () => {
		if (!heroExitFrame) heroExitFrame = requestAnimationFrame(updateHeroExit)
	}
	addEventListener('scroll', scheduleHeroExit, { passive: true })
	addEventListener('resize', () => {
		heroBase = null
		resetHeroExit()
		scheduleHeroExit()
	})
	const stopHeroEffects = () => {
		if (allowed()) {
			if (hero?.getBoundingClientRect().bottom > 0) startHero()
			return
		}
		clearTimeout(heroReadyTimer)
		hero?.classList.remove('hero-booting')
		if (heroStarted) {
			hero?.classList.add('hero-ready')
			root.classList.add('hero-ready')
		}
		clearDemo()
		resetHeroExit()
		if (bootPending) finishStartup()
	}
	document.addEventListener('portfolio:motion-change', stopHeroEffects)
	document.addEventListener('visibilitychange', stopHeroEffects)
	reduced.addEventListener('change', stopHeroEffects)

	// Every part of the portfolio has its own entrance language. Parent and child
	// transforms are intentionally never scheduled together.
	const projectCount = document.querySelectorAll('#work .project-anchor').length
	const renderProfiles = {
		work: [
			'PROJECTS.EXE',
			'Indexing selected cases',
			`${String(projectCount).padStart(2, '0')} OBJECTS READY`,
		],
		skills: ['STACK.MAP', 'Linking technology nodes', 'GRAPH READY'],
		about: ['PROFILE.INI', 'Reading user properties', 'PROFILE READY'],
		contact: [
			'NETWORK.EXE',
			'Opening communication routes',
			'04 CHANNELS ONLINE',
		],
	}
	const renderedSections = new WeakSet()
	const renderObserver = new IntersectionObserver(
		entries =>
			entries.forEach(entry => {
				const section = entry.target
				if (!entry.isIntersecting || renderedSections.has(section)) return
				renderedSections.add(section)
				renderObserver.unobserve(section)
				const overlay = section.querySelector('.section-renderer')
				if (!overlay || !allowed()) {
					overlay?.remove()
					document.dispatchEvent(
						new CustomEvent('portfolio:section-rendered', { detail: section }),
					)
					return
				}
				section.classList.add('section-rendering')
				setTimeout(() => {
					section.classList.remove('section-rendering')
					overlay.remove()
					document.dispatchEvent(
						new CustomEvent('portfolio:section-rendered', { detail: section }),
					)
				}, 2300)
			}),
		{ threshold: 0.08, rootMargin: '0px 0px -10% 0px' },
	)
	Object.entries(renderProfiles).forEach(([id, lines]) => {
		const section = document.getElementById(id)
		if (!section) return
		const overlay = document.createElement('div')
		overlay.className = 'section-renderer'
		overlay.dataset.renderer = id
		overlay.setAttribute('aria-hidden', 'true')
		lines.forEach((line, index) => {
			const row = document.createElement(index === 0 ? 'strong' : 'span')
			row.className = 'section-render-line'
			row.textContent =
				index === 0
					? `C:\\BLUVVIS\\${line}`
					: `${index === 1 ? '[ .. ]' : '[ OK ]'} ${line}`
			overlay.append(row)
		})
		const blocks = document.createElement('i')
		blocks.className = 'section-render-blocks'
		overlay.append(blocks)
		section.append(overlay)
		renderObserver.observe(section)
	})
	const targetSelector = [
		'#work > .xp-titlebar',
		'#work > .xp-address',
		'#work > .section-heading',
		'.feature',
		'.project-card',
		'#skills > .xp-titlebar',
		'#skills > .xp-address',
		'#skills > .section-heading',
		'.skills-explorer',
		'.skill-group',
		'#about > .xp-titlebar',
		'#about > .xp-address',
		'.xp-profile-summary',
		'.about-grid > :first-child',
		'.about-copy',
		'#contact > .xp-titlebar',
		'#contact > .xp-address',
		'.contact-intro',
		'.contact-card',
	].join(',')
	const targets = [...document.querySelectorAll(targetSelector)]
	const prepared = new Map()
	const started = new WeakSet()
	const pendingTargets = new Set()
	const projectCards = [...document.querySelectorAll('.project-card')]
	const skillGroups = [...document.querySelectorAll('.skill-group')]
	const framesFor = element => {
		if (element.matches('.hero-portrait'))
			return [
				{ clipPath: 'inset(0 0 100% 0)', translate: '0 0' },
				{ clipPath: 'inset(0)', translate: '0 0' },
			]
		if (element.matches('.profile-window'))
			return [
				{ translate: '0 38px', scale: '.96 .9' },
				{ translate: '0 0', scale: '1' },
			]
		if (element.matches('.workflow-window'))
			return [
				{ clipPath: 'inset(0 100% 0 0)', translate: '-18px 0' },
				{ clipPath: 'inset(0)', translate: '0 0' },
			]
		if (element.matches('.feature'))
			return [
				{
					clipPath: 'inset(0 0 92% 0 round 5px)',
					translate: '0 26px',
					scale: '.985',
				},
				{
					clipPath: 'inset(0 0 76% 0 round 5px)',
					translate: '0 0',
					scale: '1',
					offset: 0.24,
				},
				{ clipPath: 'inset(0)', translate: '0 0' },
			]
		if (element.matches('.project-card')) {
			const index = projectCards.indexOf(element)
			const direction = innerWidth > 820 && index % 2 ? 1 : -1
			return [
				{
					translate: `${direction * 34}px 52px`,
					rotate: `${direction * 0.8}deg`,
					scale: '.97',
				},
				{ translate: '0 0', rotate: '0deg', scale: '1' },
			]
		}
		if (element.matches('.skills-explorer'))
			return [
				{ clipPath: 'circle(0% at 34% 44%)', scale: '.985' },
				{ clipPath: 'circle(145% at 34% 44%)', scale: '1' },
			]
		if (element.matches('.skill-group')) {
			const index = skillGroups.indexOf(element)
			return [
				{ translate: index % 2 ? '30px 18px' : '-30px 18px', scale: '.975' },
				{ translate: '0 0', scale: '1' },
			]
		}
		if (element.matches('.xp-profile-summary'))
			return [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0)' }]
		if (element.matches('.about-grid > :first-child'))
			return [
				{ clipPath: 'inset(0 100% 0 0)', translate: '-28px 0' },
				{ clipPath: 'inset(0)', translate: '0 0' },
			]
		if (element.matches('.about-copy'))
			return [
				{ clipPath: 'inset(0 0 0 100%)', translate: '32px 0' },
				{ clipPath: 'inset(0)', translate: '0 0' },
			]
		if (element.matches('.contact-intro'))
			return [
				{ clipPath: 'inset(100% 0 0 0)', translate: '0 36px' },
				{ clipPath: 'inset(0)', translate: '0 0' },
			]
		if (element.matches('.contact-card'))
			return [
				{
					translate: innerWidth > 820 ? '54px 46px' : '0 46px',
					scale: '.82',
					rotate: '1.2deg',
				},
				{ translate: '0 0', scale: '1.025', rotate: '-.2deg', offset: 0.78 },
				{ translate: '0 0', scale: '1', rotate: '0deg' },
			]
		if (element.matches('.section-heading'))
			return [
				{ clipPath: 'inset(0 100% 0 0)', translate: '-22px 0' },
				{ clipPath: 'inset(0)', translate: '0 0' },
			]
		if (element.matches('.xp-address'))
			return [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0)' }]
		if (element.matches('.xp-titlebar'))
			return [
				{ translate: '-42px 0', scale: '.97 1' },
				{ translate: '0 0', scale: '1' },
			]
		return [{ translate: '0 28px' }, { translate: '0 0' }]
	}
	const durationFor = element => {
		if (element.matches('.feature, .skills-explorer')) return 1100
		if (element.matches('.contact-card')) return 920
		if (element.matches('.hero-portrait, .about-copy, .contact-intro'))
			return 860
		if (element.matches('.xp-address')) return 620
		return 760
	}
	const delayFor = element => {
		if (element.matches('.xp-address')) return 110
		if (element.matches('.project-card'))
			return (projectCards.indexOf(element) % 2) * 90
		if (element.matches('.skill-group'))
			return (skillGroups.indexOf(element) % 2) * 80
		return 0
	}
	const prepare = element => {
		if (prepared.has(element) || started.has(element)) return
		if (!allowed() || element.contains(document.activeElement)) {
			started.add(element)
			return
		}
		const animation = play(element, framesFor(element), {
			duration: durationFor(element),
			delay: delayFor(element),
			easing: 'cubic-bezier(.2,.72,.22,1)',
			fill: 'backwards',
		})
		animation.pause()
		animation.currentTime = 0
		prepared.set(element, animation)
		animation.finished.catch(() => {}).finally(() => prepared.delete(element))
	}
	// Prime offscreen so the starting position never snaps into place in front of the reader.
	const near = new IntersectionObserver(
		entries =>
			entries.forEach(entry => {
				if (entry.isIntersecting) prepare(entry.target)
			}),
		{ rootMargin: '320px 0px' },
	)
	const visible = new IntersectionObserver(
		entries =>
			entries.forEach(entry => {
				if (!entry.isIntersecting || started.has(entry.target)) return
				const section = entry.target.closest('main > section[id]')
				if (section?.querySelector(':scope > .section-renderer')) {
					prepare(entry.target)
					pendingTargets.add(entry.target)
					return
				}
				prepare(entry.target)
				started.add(entry.target)
				const animation = prepared.get(entry.target)
				if (animation && allowed()) {
					entry.target.classList.add('scene-entering')
					animation.play()
					animation.finished
						.catch(() => {})
						.finally(() => entry.target.classList.remove('scene-entering'))
				} else animation?.cancel()
			}),
		{ rootMargin: '0px 0px -72px 0px' },
	)
	document.addEventListener('portfolio:section-rendered', event => {
		const section = event.detail
		pendingTargets.forEach(element => {
			if (!section?.contains(element)) return
			const rect = element.getBoundingClientRect()
			if (rect.bottom <= 0 || rect.top >= innerHeight - 72) return
			pendingTargets.delete(element)
			if (started.has(element)) return
			prepare(element)
			started.add(element)
			const animation = prepared.get(element)
			if (animation && allowed()) {
				element.classList.add('scene-entering')
				animation.play()
				animation.finished
					.catch(() => {})
					.finally(() => element.classList.remove('scene-entering'))
			} else animation?.cancel()
		})
	})
	targets.forEach(element => {
		near.observe(element)
		visible.observe(element)
	})

	const terminal = document.querySelector('.workflow-lines')
	if (terminal) {
		let started = false
		let requested = false
		let inView = false
		let finish = () => {}
		const beginTyping = () => {
			if (!requested || !inView || started || startupSkipped || !allowed())
				return
			started = true
			const rows = [...terminal.querySelectorAll('p')].map(row => {
				const source = document.createElement('span')
				source.className = 'typing-source'
				source.append(...row.childNodes)
				const visual = document.createElement('span')
				visual.className = 'typing-visual'
				visual.setAttribute('aria-hidden', 'true')
				row.append(source, visual)
				return { row, source, visual, text: source.textContent.trim() }
			})
			terminal.classList.add('is-typing')
			let timer
			finish = () => {
				clearTimeout(timer)
				terminal.classList.remove('is-typing')
				rows.forEach(({ row, source, visual }) => {
					if (!source.isConnected) return
					visual.remove()
					source.replaceWith(...source.childNodes)
				})
				finishTyping.delete(finish)
			}
			finishTyping.add(finish)
			let line = 0,
				letter = 0
			const tick = () => {
				if (!allowed()) {
					finish()
					return
				}
				const current = rows[line]
				current.visual.classList.add('is-writing')
				current.visual.textContent = current.text.slice(0, ++letter)
				if (letter >= current.text.length) {
					current.visual.classList.remove('is-writing')
					line++
					letter = 0
					if (line === rows.length) {
						finish()
						return
					}
				}
				timer = setTimeout(tick, letter === 0 ? 220 : 32)
			}
			timer = setTimeout(tick, 80)
		}
		const typingObserver = new IntersectionObserver(
			([entry]) => {
				inView = entry.isIntersecting
				if (!inView) {
					finish()
					return
				}
				beginTyping()
			},
			{ threshold: 0.6 },
		)
		typingObserver.observe(terminal)
		document.addEventListener('portfolio:terminal-start', () => {
			requested = true
			beginTyping()
		})
	}

	// The data-flow accent has its own visibility gate.
	const bars = new IntersectionObserver(
		entries =>
			entries.forEach(entry => {
				entry.target.classList.toggle('motion-in-view', entry.isIntersecting)
			}),
		{ threshold: 0.5 },
	)
	document.querySelectorAll('.architecture').forEach(el => bars.observe(el))

	// Pointer light is local to the hovered card, with a single pending frame.
	let pointerFrame = 0
	let litCard
	const clearLight = () => {
		litCard?.classList.remove('pointer-lit')
		litCard = null
	}
	document.addEventListener(
		'pointermove',
		event => {
			if (!allowed() || !fine.matches) {
				clearLight()
				return
			}
			const card = event.target.closest(
				'.project-card, .profile-window, .skill-group, .demo-console',
			)
			if (card !== litCard) {
				clearLight()
				litCard = card
			}
			if (!card || pointerFrame) return
			const { clientX, clientY } = event
			pointerFrame = requestAnimationFrame(() => {
				pointerFrame = 0
				if (litCard !== card || !allowed()) return
				const rect = card.getBoundingClientRect()
				card.style.setProperty('--pointer-x', `${clientX - rect.left}px`)
				card.style.setProperty('--pointer-y', `${clientY - rect.top}px`)
				card.classList.add('pointer-lit')
			})
		},
		{ passive: true },
	)
	document.documentElement.addEventListener('pointerleave', clearLight)
	addEventListener('scroll', clearLight, { passive: true })
	document.addEventListener('portfolio:motion-change', clearLight)

	// A short expanding outline makes every real control feel responsive.
	document.addEventListener('click', event => {
		if (!allowed()) return
		const control = event.target.closest(
			'.button, .xp-task-buttons a, .desktop-shortcuts a, .xp-start-button, .skill-group a',
		)
		if (!control) return
		play(
			control,
			[
				{ boxShadow: '0 0 0 0 #ff398a99' },
				{ boxShadow: '0 0 0 12px #ff398a00' },
			],
			{ duration: 500, easing: 'ease-out' },
		)
	})
})()
