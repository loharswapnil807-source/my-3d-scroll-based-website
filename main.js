/*
 * UI shell for the portfolio.
 *
 * Three.js lives in src/scene.js so the visual runtime can be tested and
 * disposed independently from navigation, reveals, and accessibility state.
 */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const MOBILE_MENU_QUERY = '(max-width: 48rem)';
const THEME_KEY = 'swapnil-portfolio-theme';

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

const setupTheme = () => {
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;
  const themes = ['teal', 'violet', 'warm'];
  const labels = { teal: 'teal', violet: 'violet', warm: 'warm light' };
  const preference = window.matchMedia('(prefers-color-scheme: light)');
  const preferred = preference.matches ? 'warm' : 'teal';
  const readTheme = () => {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  };
  const saveTheme = (value) => {
    try {
      localStorage.setItem(THEME_KEY, value);
    } catch {
      // Private browsing and blocked storage should not stop the page booting.
    }
  };
  let theme = themes.includes(readTheme()) ? readTheme() : preferred;
  let userSelectedTheme = Boolean(readTheme());
  const sync = () => {
    document.documentElement.dataset.theme = theme;
    toggle.textContent = `Theme: ${labels[theme]}`;
    toggle.setAttribute('aria-label', `Switch color theme. Current theme: ${labels[theme]}`);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'warm' ? '#FAF7F2' : theme === 'violet' ? '#0B0713' : '#070A12');
    window.dispatchEvent(new CustomEvent('portfolio:themechange', { detail: { theme } }));
  };
  toggle.addEventListener('click', () => {
    theme = themes[(themes.indexOf(theme) + 1) % themes.length];
    userSelectedTheme = true;
    saveTheme(theme);
    sync();
  });
  preference.addEventListener?.('change', (event) => {
    if (userSelectedTheme) return;
    theme = event.matches ? 'warm' : 'teal';
    sync();
  });
  sync();
};

const setupContact = () => {
  const button = document.getElementById('copy-email');
  const form = document.querySelector('.contact-form');
  const formNote = document.getElementById('contact-form-note');
  if (button) {
    button.addEventListener('click', async () => {
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
        await navigator.clipboard.writeText('loharswapnil807@gmail.com');
        button.textContent = 'Copied';
        window.setTimeout(() => { button.textContent = 'Copy email'; }, 1800);
      } catch {
        window.location.href = 'mailto:loharswapnil807@gmail.com';
      }
    });
  }
  if (!form) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const subject = `Portfolio contact from ${data.get('name')}`;
    const body = `Name: ${data.get('name')}\\nEmail: ${data.get('email')}\\n\\n${data.get('message')}`;
    if (formNote) formNote.textContent = 'Opening your email app…';
    window.location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
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

  let motionEnabled = !reducedMotionQuery.matches;
  const sync = () => {
    const systemReduced = reducedMotionQuery.matches;
    document.documentElement.classList.toggle('motion-paused', !motionEnabled || systemReduced);
    toggle.disabled = systemReduced;
    toggle.setAttribute('aria-pressed', String(!motionEnabled || systemReduced));
    toggle.textContent = systemReduced ? 'Motion disabled' : motionEnabled ? 'Pause motion' : 'Resume motion';
    toggle.title = systemReduced ? 'System reduced-motion preference is active' : toggle.textContent;
  };

  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    if (reducedMotionQuery.matches) return;
    motionEnabled = !motionEnabled;
    controller?.setMotion(motionEnabled);
    sync();
  });
  reducedMotionQuery.addEventListener?.('change', () => {
    motionEnabled = !reducedMotionQuery.matches;
    controller?.setMotion(motionEnabled);
    sync();
  });
  sync();
};

const bootScene = async (reducedMotionQuery) => {
  setLoader(true, 'Loading', 'Preparing the field');
  let fallbackActivated = false;
  let sceneController = null;
  const activateFallback = () => {
    if (fallbackActivated) return;
    fallbackActivated = true;
    document.documentElement.classList.add('webgl-unavailable');
    const canvas = document.getElementById('scene');
    if (canvas) {
      canvas.hidden = true;
      canvas.dataset.state = 'unavailable';
    }
    setLoader(false, 'Fallback', 'Static field');
  };
  const loaderTimeout = window.setTimeout(activateFallback, 5000);

  try {
    const { initScene } = await import('./src/scene.js');
    // A slow CDN response must not be allowed to undo the static fallback.
    if (fallbackActivated) {
      setupMotionToggle(reducedMotionQuery, null);
      return;
    }
    sceneController = initScene({
      motionEnabled: !reducedMotionQuery.matches,
      onReady: () => {
        if (!fallbackActivated) setLoader(false, 'Ready', 'Field online');
      },
    });

    if (!sceneController) throw new Error('WebGL scene could not be initialized');
    if (fallbackActivated) {
      sceneController.dispose?.();
      setupMotionToggle(reducedMotionQuery, null);
      return;
    }
    setupMotionToggle(reducedMotionQuery, sceneController);
    setLoader(false, 'Ready', 'Field online');
  } catch (error) {
    console.warn('3D scene unavailable; continuing with the accessible fallback.', error);
    sceneController?.dispose?.();
    activateFallback();
    setupMotionToggle(reducedMotionQuery, null);
  } finally {
    window.clearTimeout(loaderTimeout);
  }
};

const init = () => {
  document.documentElement.classList.add('js-ready');
  const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  setupNavigation();
  setupTheme();
  setupContact();
  setupReveals(reducedMotionQuery);
  setupSectionNavigation();
  bootScene(reducedMotionQuery);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
