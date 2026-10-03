/*
 * UI shell for the portfolio.
 *
 * Three.js lives in src/scene.js so the visual runtime can be tested and
 * disposed independently from navigation, reveals, and accessibility state.
 */

import { setupInteractions } from './src/interactions.js';

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
    const focusWasInMenu = menu.contains(document.activeElement);
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
    sync();
    if (focusWasInMenu && mobileQuery.matches) toggle.focus();
  };

  const openOrClose = () => {
    const isOpen = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
    sync();
  };

  toggle.addEventListener('click', openOrClose);
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    close();
    const target = document.querySelector(link.getAttribute('href'));
    target?.setAttribute('tabindex', '-1');
    target?.focus({ preventScroll: true });
  }));
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
  const preferred = 'teal';
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
  const savedTheme = readTheme();
  let theme = themes.includes(savedTheme) ? savedTheme : preferred;
  let userSelectedTheme = themes.includes(savedTheme);
  const sync = () => {
    document.documentElement.dataset.theme = theme;
    toggle.textContent = `Theme: ${labels[theme]}`;
    toggle.setAttribute('aria-label', `Switch color theme. Current theme: ${labels[theme]}`);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
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
        const status = document.getElementById('copy-status');
        if (status) status.textContent = 'Email address copied.';
        window.setTimeout(() => { button.textContent = 'Copy email'; }, 1800);
      } catch {
        const address = document.querySelector('.contact-value');
        const range = document.createRange();
        if (address) {
          range.selectNodeContents(address);
          window.getSelection()?.removeAllRanges();
          window.getSelection()?.addRange(range);
        }
        const status = document.getElementById('copy-status');
        if (status) status.textContent = 'Clipboard unavailable. Email selected — copy it manually.';
      }
    });
  }
  if (!form) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const subject = `Portfolio contact from ${data.get('name')}`;
    const body = `Name: ${data.get('name')}\nEmail: ${data.get('email')}\n\n${data.get('message')}`;
    if (formNote) formNote.textContent = 'Email draft requested. Nothing has been sent: review and send it in your email app. If no app opens, copy the address above.';
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
  if (!controller) {
    toggle.hidden = true;
    return;
  }

  let motionEnabled = !reducedMotionQuery.matches;
  const sync = () => {
    const systemReduced = reducedMotionQuery.matches;
    document.documentElement.classList.toggle('motion-paused', !motionEnabled || systemReduced);
    toggle.disabled = systemReduced;
    toggle.setAttribute('aria-pressed', String(!motionEnabled || systemReduced));
    toggle.textContent = systemReduced ? 'Motion disabled' : motionEnabled ? 'Pause motion' : 'Resume motion';
    toggle.title = systemReduced ? 'System reduced-motion preference is active' : toggle.textContent;
    window.dispatchEvent(new CustomEvent('portfolio:motionchange', { detail: { enabled: motionEnabled && !systemReduced } }));
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
      onFailure: () => {
        activateFallback();
        setupMotionToggle(reducedMotionQuery, null);
      },
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
  setupInteractions(reducedMotionQuery);
  setupReveals(reducedMotionQuery);
  setupSectionNavigation();
  // Keep the first content paint independent of the optional 3D dependency.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => bootScene(reducedMotionQuery), { timeout: 1500 });
    else window.setTimeout(() => bootScene(reducedMotionQuery), 0);
  }));
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
