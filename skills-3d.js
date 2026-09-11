import * as THREE from './vendor/three.module.js'
import { CSS2DRenderer, CSS2DObject } from './vendor/CSS2DRenderer.js'

export function initSphere(stage) {
	const source = [...document.querySelectorAll('#skillGroups [data-sphere]')]
	const skills = source.map(item => ({
		name: item.dataset.skill,
		category: item.dataset.category,
		description: item.dataset.description,
		projects: item.dataset.projects.split(' '),
	}))
	if (!skills.length) throw new Error('Skill list is empty')
	const categoryNames = {
		frontend: 'Frontend',
		backend: 'Backend',
		ml: 'ML / Data',
		delivery: 'Delivery / Tests',
	}
	const palette = {
		frontend: 0xff398a,
		backend: 0x38cfff,
		ml: 0xffbc38,
		delivery: 0x48df9c,
	}
	const status = document.querySelector('#sphereStatus')
	const pause = document.querySelector('#spherePause')
	const motion = matchMedia('(prefers-reduced-motion: reduce)')
	const events = new AbortController()
	const listen = (target, event, handler, options = {}) =>
		target.addEventListener(event, handler, {
			...options,
			signal: events.signal,
		})
	let renderer
	let labels
	let resizeObserver
	let viewportObserver
	let frame = 0
	let disposed = false
	let visible = false
	let globalPaused = document.documentElement.dataset.motion === 'paused'
	let userPaused = false
	let selectionPausedUntil = 0
	let selectionPauseTimer = 0
	let waitingForPointerMove = false
	let dragging = false
	let pointerId = null
	let lastX = 0
	let lastTime = 0
	let elapsed = 0
	let selected = 0
	let horizontalAngle = -0.3
	const nodes = []
	const lines = []
	const scene = new THREE.Scene()
	const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
	const sphere = new THREE.Group()
	scene.add(sphere)
	const vector = new THREE.Vector3()

	function dispose(message) {
		if (disposed) return
		disposed = true
		cancelAnimationFrame(frame)
		clearTimeout(selectionPauseTimer)
		events.abort()
		resizeObserver?.disconnect()
		viewportObserver?.disconnect()
		const geometries = new Set()
		const materials = new Set()
		scene.traverse(object => {
			if (object.geometry) geometries.add(object.geometry)
			if (object.material)
				(Array.isArray(object.material)
					? object.material
					: [object.material]
				).forEach(material => materials.add(material))
		})
		geometries.forEach(geometry => geometry.dispose())
		materials.forEach(material => material.dispose())
		renderer?.dispose()
		renderer?.domElement.remove()
		labels?.domElement.remove()
		if (pause) pause.hidden = true
		if (message) {
			status.hidden = false
			status.textContent = message
			stage.classList.add('is-unavailable')
			stage.removeAttribute('tabindex')
			stage.setAttribute('aria-label', '3D-карта недоступна')
		}
	}

	function requestFrame() {
		if (!disposed && visible && !document.hidden && !frame)
			frame = requestAnimationFrame(render)
	}

	let detailAnimation
	function select(index, announce = false) {
		const changed = selected !== index
		selected = index
		const skill = skills[index]
		const detail = document.querySelector('#skillDetail')
		detail.dataset.category = skill.category
		if (changed && !motion.matches && !globalPaused && detail.animate) {
			detailAnimation?.cancel()
			detailAnimation = detail.animate(
				[
					{ opacity: 0.65, transform: 'translateY(6px)' },
					{ opacity: 1, transform: 'translateY(0)' },
				],
				{ duration: 240, easing: 'ease-out' },
			)
		}
		document.querySelector('#skillDetailCategory').textContent =
			categoryNames[skill.category]
		document.querySelector('#skillDetailTitle').textContent = skill.name
		document.querySelector('#skillDetailDescription').textContent =
			skill.description
		const projects = document.querySelector('#skillDetailProjects')
		projects.replaceChildren()
		skill.projects.forEach(id => {
			const target = document.getElementById(id)
			if (!target) return
			const item = document.createElement('li')
			const link = document.createElement('a')
			link.href = `#${id}`
			link.textContent = target.dataset.projectName
			const arrow = document.createElement('span')
			arrow.textContent = '↗'
			arrow.setAttribute('aria-hidden', 'true')
			link.append(arrow)
			item.append(link)
			projects.append(item)
		})
		nodes.forEach((node, i) => {
			node.button.setAttribute('aria-pressed', String(i === index))
			node.button.classList.toggle(
				'is-related',
				i !== index && skills[i].category === skill.category,
			)
		})
		lines.forEach(line => {
			const active = line.userData.a === index || line.userData.b === index
			line.material.opacity = active ? 0.46 : 0.07
		})
		if (announce)
			document.querySelector('#skillAnnouncement').textContent =
				`${skill.name}. ${skill.description} Связанные проекты показаны в панели.`
		requestFrame()
	}

	function updateMotion() {
		if (motion.matches || globalPaused) detailAnimation?.cancel()
		if (pause) {
			const systemPaused = motion.matches || globalPaused
			pause.disabled = systemPaused
			pause.setAttribute('aria-pressed', String(userPaused || systemPaused))
			pause.textContent = systemPaused
				? 'Анимация отключена'
				: userPaused
					? 'Продолжить вращение ▷'
					: 'Пауза вращения Ⅱ'
		}
		lastTime = 0
		requestFrame()
	}

	function pauseAfterSelection() {
		if (motion.matches || globalPaused) return

		selectionPausedUntil = performance.now() + 500
		waitingForPointerMove = true

		clearTimeout(selectionPauseTimer)
		selectionPauseTimer = setTimeout(() => {
			selectionPausedUntil = 0
			lastTime = 0
			requestFrame()
		}, 500)

		requestFrame()
	}

	function resumeAfterPointerMove() {
		if (!waitingForPointerMove) return

		const now = performance.now()

		// Движение во время обязательной паузы ничего не запускает.
		if (now < selectionPausedUntil) return

		waitingForPointerMove = false
		selectionPausedUntil = 0
		clearTimeout(selectionPauseTimer)
		lastTime = 0
		requestFrame()
	}

	function resize() {
		if (disposed) return
		const width = stage.clientWidth
		const height = stage.clientHeight
		if (!width || !height) return
		camera.aspect = width / height
		// Fit the sphere to the narrower axis, keeping space for labels and controls.
		const halfFov = THREE.MathUtils.degToRad(camera.fov / 2)
		const fitDistance = 2.22 / (Math.tan(halfFov) * Math.min(camera.aspect, 1))
		camera.position.set(0, 0, fitDistance * (width < 450 ? 1.28 : 1.15))
		camera.updateProjectionMatrix()
		camera.updateMatrixWorld()
		renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75))
		renderer.setSize(width, height)
		labels.setSize(width, height)
		requestFrame()
	}

	function render(now) {
		frame = 0
		if (disposed || !visible || document.hidden) {
			lastTime = 0
			return
		}
		const automatic =
			!userPaused &&
			!globalPaused &&
			!motion.matches &&
			!dragging &&
			!waitingForPointerMove &&
			now >= selectionPausedUntil
		const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0
		lastTime = now
		if (automatic) {
			horizontalAngle += dt * 0.11
			elapsed += dt
			sphere.rotation.x = Math.sin(elapsed * 0.22) * 0.035
		}
		sphere.rotation.y = horizontalAngle
		sphere.updateMatrixWorld(true)
		// All labels stay present. Only scale and opacity express depth.
		nodes.forEach(node => {
			node.label.getWorldPosition(vector)
			const depth = Math.max(0, Math.min(1, (vector.z + 2) / 4))
			const smoothDepth = depth * depth * (3 - 2 * depth)
			node.button.style.setProperty(
				'--depth-scale',
				String(0.9 + smoothDepth * 0.16),
			)
			node.button.style.setProperty(
				'--depth-opacity',
				String(0.42 + smoothDepth * 0.58),
			)
		})
		try {
			renderer.render(scene, camera)
			labels.render(scene, camera)
		} catch (error) {
			dispose('3D-карта недоступна. Продолжайте со списком технологий ниже.')
			console.warn('Ошибка карты технологий:', error)
			return
		}
		if (automatic) requestFrame()
	}

	try {
		renderer = new THREE.WebGLRenderer({
			alpha: true,
			antialias: true,
			powerPreference: 'low-power',
		})
		renderer.domElement.className = 'skills-3d-canvas'
		renderer.domElement.setAttribute('aria-hidden', 'true')
		labels = new CSS2DRenderer()
		labels.domElement.className = 'skills-3d-labels'
		stage.append(renderer.domElement, labels.domElement)

		renderer.domElement.style.visibility = 'hidden'
		labels.domElement.style.visibility = 'hidden'

		const particles = []
		for (let i = 0; i < 100; i++) {
			const phi = Math.acos(1 - (2 * (i + 0.5)) / 100)
			const theta = Math.PI * (3 - Math.sqrt(5)) * i
			particles.push(
				2 * Math.sin(phi) * Math.cos(theta),
				2 * Math.cos(phi),
				2 * Math.sin(phi) * Math.sin(theta),
			)
		}
		const geometry = new THREE.BufferGeometry()
		geometry.setAttribute(
			'position',
			new THREE.Float32BufferAttribute(particles, 3),
		)
		sphere.add(
			new THREE.Points(
				geometry,
				new THREE.PointsMaterial({
					color: 0xe7e5de,
					size: 0.018,
					transparent: true,
					opacity: 0.3,
				}),
			),
		)
		;[0, Math.PI / 2].forEach(angle => {
			const ring = new THREE.Mesh(
				new THREE.TorusGeometry(2.04, 0.0025, 5, 96),
				new THREE.MeshBasicMaterial({
					color: 0xe7e5de,
					transparent: true,
					opacity: 0.15,
				}),
			)
			ring.rotation.x = angle
			sphere.add(ring)
		})
		sphere.add(
			new THREE.Mesh(
				new THREE.SphereGeometry(0.035, 10, 10),
				new THREE.MeshBasicMaterial({ color: 0xff2d8d }),
			),
		)

		skills.forEach((skill, i) => {
			const phi = Math.acos(1 - (2 * (i + 0.5)) / skills.length)
			const theta = Math.PI * (3 - Math.sqrt(5)) * i
			const position = new THREE.Vector3(
				2 * Math.sin(phi) * Math.cos(theta),
				2 * Math.cos(phi),
				2 * Math.sin(phi) * Math.sin(theta),
			)
			const wrapper = document.createElement('div')
			wrapper.className = 'skill-node'
			const button = document.createElement('button')
			button.type = 'button'
			button.className = 'skill-node-button'
			button.dataset.category = skill.category
			button.textContent = skill.name
			button.setAttribute(
				'aria-label',
				`${skill.name} — показать опыт и проекты`,
			)
			button.setAttribute('aria-controls', 'skillDetail')
			button.setAttribute('aria-pressed', String(i === 0))
			wrapper.append(button)
			const label = new CSS2DObject(wrapper)
			// Unique render order avoids abrupt depth-based z-index swaps.
			label.renderOrder = skills.length - i
			label.position.copy(position)
			sphere.add(label)
			nodes.push({ label, button, position })
			listen(button, 'focus', () => select(i, true))
			listen(button, 'click', () => {
				select(i, true)
				pauseAfterSelection()
			})
		})

		// Sparse, meaningful connections between tools used together.
		const relations = [
			['React', 'TypeScript'],
			['React', 'FastAPI'],
			['FastAPI', 'Python'],
			['FastAPI', 'PostgreSQL'],
			['PostgreSQL', 'SQL / SQLAlchemy'],
			['Python', 'scikit-learn'],
			['scikit-learn', 'pandas'],
			['Python', 'NLP / n-grams'],
			['Python', 'Transformers'],
			['PySpark', 'Cassandra'],
			['Docker', 'Kubernetes'],
			['Kubernetes', 'Helm'],
			['FastAPI', 'pytest'],
			['React', 'Vitest'],
		]
		relations.forEach(([a, b]) => {
			const ai = skills.findIndex(skill => skill.name === a)
			const bi = skills.findIndex(skill => skill.name === b)
			if (ai < 0 || bi < 0) return
			const line = new THREE.Line(
				new THREE.BufferGeometry().setFromPoints([
					nodes[ai].position,
					nodes[bi].position,
				]),
				new THREE.LineBasicMaterial({
					color: palette[skills[ai].category],
					transparent: true,
					opacity: 0.07,
				}),
			)
			line.userData = { a: ai, b: bi }
			sphere.add(line)
		lines.push(line)
		})
		if (pause) {
			listen(pause, 'click', () => {
				userPaused = !userPaused
				updateMotion()
			})
		}
		listen(motion, 'change', updateMotion)
		listen(document, 'portfolio:motion-change', () => {
			globalPaused = document.documentElement.dataset.motion === 'paused'
			updateMotion()
		})
		listen(stage, 'keydown', event => {
			if (
				event.target !== stage ||
				!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)
			)
				return
			event.preventDefault()
			horizontalAngle =
				event.key === 'Home'
					? -0.3
					: horizontalAngle + (event.key === 'ArrowRight' ? 0.18 : -0.18)
			requestFrame()
		})
		listen(stage, 'pointerdown', event => {
			if (
				event.target.closest('button') ||
				!event.isPrimary ||
				event.button !== 0
			)
				return
			pointerId = event.pointerId
			dragging = true
			lastX = event.clientX
			stage.classList.add('is-dragging')
			stage.setPointerCapture(pointerId)
		})
		listen(stage, 'pointermove', event => {
			visible = true
			resumeAfterPointerMove()
			requestFrame()
			if (!dragging || event.pointerId !== pointerId) return
			horizontalAngle += (event.clientX - lastX) * 0.008
			lastX = event.clientX
			requestFrame()
		})
		const stopDrag = () => {
			const captured = pointerId
			pointerId = null
			dragging = false
			stage.classList.remove('is-dragging')
			if (captured !== null && stage.hasPointerCapture(captured))
				stage.releasePointerCapture(captured)
			lastTime = 0
			requestFrame()
		}
		listen(stage, 'pointerup', stopDrag)
		listen(stage, 'pointercancel', stopDrag)
		listen(stage, 'lostpointercapture', stopDrag)
		listen(renderer.domElement, 'webglcontextlost', event => {
			event.preventDefault()
			dispose(
				'3D-карта остановлена. Все навыки и проекты доступны в списке ниже.',
			)
		})
		listen(document, 'visibilitychange', () => {
			if (document.hidden) {
				cancelAnimationFrame(frame)
				frame = 0
				lastTime = 0
			} else requestFrame()
		})
		listen(window, 'pagehide', event => {
			if (!event.persisted) dispose()
		})
		if ('ResizeObserver' in window) {
			resizeObserver = new ResizeObserver(resize)
			resizeObserver.observe(stage)
		} else listen(window, 'resize', resize)
		if ('IntersectionObserver' in window) {
			viewportObserver = new IntersectionObserver(([entry]) => {
				visible = entry.isIntersecting
				lastTime = 0
				if (visible) requestFrame()
				else {
					cancelAnimationFrame(frame)
					frame = 0
				}
			})
			viewportObserver.observe(stage)
		} else visible = true
		resize()
		document.fonts?.ready.then(() => {
			if (!disposed) resize()
		})
		select(0)
		updateMotion()
		status.hidden = true
		if (pause) pause.hidden = false
		stage.classList.add('is-ready')

		// 3D появляется только после первого кадра entrance-анимации секции.
		requestAnimationFrame(() => {
			if (disposed) return
			stage.classList.add('is-visible')
			requestFrame()
		})

		requestAnimationFrame(() => {
			if (disposed) return
			renderer.domElement.style.visibility = 'visible'
			labels.domElement.style.visibility = 'visible'
		})
	} catch (error) {
		dispose(
			'3D-карта недоступна. Все технологии и ссылки на проекты есть в списке ниже.',
		)
		throw error
	}
}
