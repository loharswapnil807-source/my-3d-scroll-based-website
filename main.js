/*
 * UI shell for the portfolio.
 *
 * Three.js lives in src/scene.js so the visual runtime can be tested and
 * disposed independently from navigation, reveals, and accessibility state.
 */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const MOBILE_MENU_QUERY = '(max-width: 48rem)';

const setLoader = (visible, status, progress) => {
  const loader = document.getElementById('loader');
  if (!loader) return;

  const statusNode = document.getElementById('loader-status');
  const progressNode = document.getElementById('loader-progress');
  if (statusNode && status) statusNode.textContent = status;
  if (progressNode && progress) progressNode.textContent = progress;
  loader.hidden = !visible;
  loader.classList.toggle('loaded', !visible);
  loader.setAttribute('aria-hidden', String(!visible));
};

const setupNavigation = () => {
  const menu = document.getElementById('nav-links');
  const toggle = document.getElementById('menu-toggle');
  const mobileQuery = window.matchMedia(MOBILE_MENU_QUERY);
  if (!menu || !toggle) return;

  const sync = () => {
    const isMobile = mobileQuery.matches;
    const isOpen = menu.classList.contains('is-open');
    menu.inert = isMobile && !isOpen;
    if (isMobile) menu.setAttribute('aria-hidden', String(!isOpen));
    else menu.removeAttribute('aria-hidden');
  };

  const close = () => {
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
    sync();
  };

  const openOrClose = () => {
    const isOpen = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
    sync();
  };

  toggle.addEventListener('click', openOrClose);
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', close));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  document.addEventListener('click', (event) => {
    if (!menu.classList.contains('is-open')) return;
    if (!(event.target instanceof Node) || menu.contains(event.target) || toggle.contains(event.target)) return;
    close();
  });

  mobileQuery.addEventListener?.('change', close);
  window.addEventListener('resize', sync, { passive: true });
  sync();
};

const setupReveals = (reducedMotionQuery) => {
  const revealElements = [...document.querySelectorAll('[data-reveal]')];
  if (!revealElements.length) return;

  if (reducedMotionQuery.matches || !('IntersectionObserver' in window)) {
    revealElements.forEach((element) => { element.dataset.reveal = 'visible'; });
    return;
  }

  revealElements.forEach((element) => { element.dataset.reveal = 'pending'; });
  const observer = new IntersectionObserver((entries, io) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.dataset.reveal = 'visible';
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  revealElements.forEach((element) => observer.observe(element));
};

const setupSectionNavigation = () => {
  const links = [...document.querySelectorAll('.nav-links a')];
  const sections = [...document.querySelectorAll('[data-scene-section]')];
  if (!links.length || !sections.length || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((link) => {
        const isCurrent = link.getAttribute('href') === `#${entry.target.id}`;
        if (isCurrent) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-42% 0px -48% 0px', threshold: 0 });

  sections.forEach((section) => observer.observe(section));
};

const setupMotionToggle = (reducedMotionQuery, controller) => {
  const toggle = document.getElementById('motion-toggle');
  if (!toggle) return;

  let motionEnabled = true;
  const sync = () => {
    document.documentElement.classList.toggle('motion-paused', !motionEnabled);
    toggle.setAttribute('aria-pressed', String(!motionEnabled));
    toggle.textContent = motionEnabled ? 'Pause motion' : 'Resume motion';
    toggle.title = reducedMotionQuery.matches
      ? 'System reduced-motion preference is active'
      : toggle.textContent;
  };

  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    motionEnabled = !motionEnabled;
    controller?.setMotion(motionEnabled);
    sync();
  });
  reducedMotionQuery.addEventListener?.('change', sync);
  sync();
};

const bootScene = async (reducedMotionQuery) => {
  setLoader(true, 'Loading', 'Preparing the field');

  try {
    const { initScene } = await import('./src/scene.js');
    const controller = initScene({
      motionEnabled: true,
      onReady: () => setLoader(false, 'Ready', 'Field online'),
    });

    if (!controller) {
      throw new Error('WebGL scene could not be initialized');
    }

    setupMotionToggle(reducedMotionQuery, controller);
    if (!document.getElementById('loader')?.hidden) {
      setLoader(false, 'Ready', 'Field online');
    }
  } catch (error) {
    console.warn('3D scene unavailable; continuing with the accessible fallback.', error);
    document.documentElement.classList.add('webgl-unavailable');
    const canvas = document.getElementById('scene');
    if (canvas) {
      canvas.hidden = true;
      canvas.dataset.state = 'unavailable';
    }
    setLoader(false, 'Ready', 'Static field');
    setupMotionToggle(reducedMotionQuery, null);
  }
};

const init = () => {
  document.documentElement.classList.add('js-ready');
  const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  setupNavigation();
  setupReveals(reducedMotionQuery);
  setupSectionNavigation();
  bootScene(reducedMotionQuery);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
