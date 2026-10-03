const HOVER_QUERY = '(hover: hover) and (pointer: fine)';
const SURFACE_SELECTOR = '.selected-work-card, .screenshot-panel, .project-stage, .contact-row';

function setupScreenshotPreviews() {
  const dialog = document.getElementById('image-preview');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const image = dialog.querySelector('.image-preview-image');
  const caption = document.getElementById('preview-caption');
  const close = dialog.querySelector('.preview-close');
  let trigger = null;

  document.querySelectorAll('[data-preview]').forEach((link) => {
    link.addEventListener('click', (event) => {
      // Keep open-in-new-tab and the ordinary image link as progressive fallbacks.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      trigger = link;
      image.src = link.href;
      image.alt = link.querySelector('img').alt;
      caption.textContent = link.dataset.caption;
      dialog.showModal();
      close.focus({ preventScroll: true });
    });
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => {
    image.removeAttribute('src');
    trigger?.focus({ preventScroll: true });
  });
}

function setupImageArrivals(reducedMotionQuery) {
  if (!('IntersectionObserver' in window) || typeof Element.prototype.animate !== 'function') return;
  const targets = [...new Set([...document.querySelectorAll('.project-stage img')]
    .map((image) => image.closest('.screenshot-panel') || image.closest('.project-stage')))];
  const animations = new Map();
  const corners = [[-1, 1], [1, -1], [-1, -1], [1, 1]];
  const allowed = () => !reducedMotionQuery.matches && !document.documentElement.classList.contains('motion-paused');
  targets.forEach((target, index) => { target.dataset.arrivalCorner = String(index % corners.length); });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      observer.unobserve(target);
      target.dataset.arrived = 'true';
      if (!allowed()) return;
      const [horizontal, vertical] = corners[Number(target.dataset.arrivalCorner)];
      const distance = Math.min(36, window.innerWidth * 0.05);
      // Individual transform properties leave the pointer tilt/hover transform free.
      // Content stays visible if JavaScript or the animation API is unavailable.
      const animation = target.animate([
        { opacity: 0.65, translate: `${horizontal * distance}px ${vertical * 24}px`, scale: '0.94', rotate: '0deg' },
        { opacity: 1, translate: '0px 0px', scale: '1', rotate: '0deg' },
      ], { duration: 1000, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
      animations.set(target, animation);
      animation.onfinish = animation.oncancel = () => animations.delete(target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
  targets.forEach((target) => observer.observe(target));

  const finishArrivals = () => {
    if (allowed()) return;
    animations.forEach((animation) => animation.cancel());
    animations.clear();
  };
  // Tabbing to an offscreen image should never leave focus on a moving target.
  targets.forEach((target) => target.addEventListener('focusin', () => {
    animations.get(target)?.cancel();
    observer.unobserve(target);
    target.dataset.arrived = 'true';
  }));
  reducedMotionQuery.addEventListener('change', finishArrivals);
  window.addEventListener('portfolio:motionchange', finishArrivals);
  window.addEventListener('pagehide', () => {
    animations.forEach((animation) => animation.cancel());
    animations.clear();
  });
}

function setupPointerGlow(reducedMotionQuery) {
  const hoverQuery = window.matchMedia(HOVER_QUERY);
  const glow = document.createElement('div');
  glow.className = 'cursor-glow cursor-effect';
  glow.setAttribute('aria-hidden', 'true');
  document.body.append(glow);

  let frame = 0;
  let active = false;
  let targetX = 0;
  let targetY = 0;
  let x = 0;
  let y = 0;
  let surface = null;
  let surfaceDirty = false;
  const allowed = () => hoverQuery.matches && !reducedMotionQuery.matches && !document.hidden && !document.documentElement.classList.contains('motion-paused');
  const clearSurface = () => {
    if (!surface) return;
    ['--pointer-x', '--pointer-y', '--tilt-x', '--tilt-y'].forEach((property) => surface.style.removeProperty(property));
    surface = null;
  };
  const hide = () => {
    active = false;
    cancelAnimationFrame(frame);
    frame = 0;
    glow.classList.remove('is-visible', 'is-interactive', 'is-pressed');
    clearSurface();
  };
  const draw = () => {
    frame = 0;
    if (!active || !allowed()) { hide(); return; }
    x += (targetX - x) * 0.36;
    y += (targetY - y) * 0.36;
    glow.style.transform = `translate3d(${x - 80}px, ${y - 80}px, 0)`;
    let moving = Math.abs(targetX - x) + Math.abs(targetY - y) > 0.2;
    if (surface && surfaceDirty) {
      const rect = surface.getBoundingClientRect();
      const px = Math.max(0, Math.min(1, (targetX - rect.left) / Math.max(1, rect.width)));
      const py = Math.max(0, Math.min(1, (targetY - rect.top) / Math.max(1, rect.height)));
      surface.style.setProperty('--pointer-x', `${px * 100}%`);
      surface.style.setProperty('--pointer-y', `${py * 100}%`);
      surface.style.setProperty('--tilt-x', `${(0.5 - py) * 5}deg`);
      surface.style.setProperty('--tilt-y', `${(px - 0.5) * 5}deg`);
      surfaceDirty = false;
    }
    if (moving) frame = requestAnimationFrame(draw);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
  const trackSurface = (element) => {
    const nextSurface = element?.closest(SURFACE_SELECTOR) || null;
    if (surface !== nextSurface) { clearSurface(); surface = nextSurface; }
    surfaceDirty = true;
    glow.classList.toggle('is-interactive', Boolean(element?.closest('a, button:not(:disabled), input, textarea')));
  };

  window.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || !allowed()) { hide(); return; }
    targetX = event.clientX;
    targetY = event.clientY;
    if (!active) {
      x = targetX; y = targetY;
    }
    active = true;
    glow.classList.add('is-visible');
    trackSurface(event.target instanceof Element ? event.target : null);
    schedule();
  }, { passive: true });
  window.addEventListener('scroll', () => {
    if (!active) return;
    trackSurface(document.elementFromPoint(targetX, targetY));
    schedule();
  }, { passive: true });
  window.addEventListener('pointerdown', () => { if (active) glow.classList.add('is-pressed'); }, { passive: true });
  window.addEventListener('pointerup', () => glow.classList.remove('is-pressed'), { passive: true });
  document.documentElement.addEventListener('pointerleave', hide);
  window.addEventListener('blur', hide);
  window.addEventListener('pagehide', hide);
  document.addEventListener('visibilitychange', hide);
  window.addEventListener('portfolio:motionchange', hide);
  hoverQuery.addEventListener('change', hide);
  reducedMotionQuery.addEventListener('change', hide);
}

export function setupInteractions(reducedMotionQuery) {
  setupScreenshotPreviews();
  setupImageArrivals(reducedMotionQuery);
  setupPointerGlow(reducedMotionQuery);
}
