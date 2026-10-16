'use strict';

(() => {
  const mark = document.querySelector('.tactile-wordmark');
  if (!mark) return;
  const letters = [...mark.querySelectorAll('.tactile-letter')];
  const ripple = mark.querySelector('.tactile-ripple');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let timers = [], rippleAnimation = null, pointerFrame = 0;
  let inView = false, introduced = false, pointer = null;

  function cancelSequence() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function release() {
    mark.classList.remove('is-touching');
    letters.forEach(letter => {
      letter.style.removeProperty('--press');
    });
  }

  function stop() {
    cancelSequence();
    cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    pointer = null;
    rippleAnimation?.cancel();
    release();
  }

  function press(x, y, strength = 1, showRipple = false) {
    if (reducedMotion.matches || !inView || document.hidden) return;
    const width = mark.offsetWidth, height = mark.offsetHeight;
    x = Math.max(0, Math.min(width, x));
    y = Math.max(height * .25, Math.min(height * .85, y));
    mark.style.setProperty('--touch-x', `${x}px`);
    mark.style.setProperty('--touch-y', `${y}px`);
    mark.classList.add('is-touching');

    // Neighboring letters share a little pressure, like a compliant surface.
    letters.forEach(letter => {
      const center = letter.offsetLeft + letter.offsetWidth / 2;
      const distance = (center - x) / (height * .48);
      const pressure = Math.exp(-distance * distance * 1.6) * strength;
      letter.style.setProperty('--press', pressure.toFixed(3));
      letter.style.setProperty('--ink-x', `${x - letter.offsetLeft}px`);
    });

    if (showRipple) {
      rippleAnimation?.cancel();
      rippleAnimation = ripple.animate([
        { opacity: .45, transform: 'translate(-50%, -50%) scale(.28)' },
        { opacity: .2, offset: .45 },
        { opacity: 0, transform: 'translate(-50%, -50%) scale(1.25)' }
      ], { duration: 950, easing: 'cubic-bezier(.2,.7,.3,1)' });
    }
  }

  function playTouchSequence() {
    stop();
    if (reducedMotion.matches || !inView || document.hidden) return;
    // A short introduction, then rest. Pointer, touch, or keyboard can replay it.
    [1, 3, 4].forEach((index, step) => {
      timers.push(setTimeout(() => {
        const letter = letters[index];
        press(letter.offsetLeft + letter.offsetWidth / 2, mark.offsetHeight * .65, 1, true);
        timers.push(setTimeout(release, 230));
      }, 320 + step * 850));
    });
  }

  function pressPointer(event, showRipple = false) {
    cancelSequence();
    const bounds = mark.getBoundingClientRect();
    press(event.clientX - bounds.left, event.clientY - bounds.top,
      event.buttons || event.pointerType === 'touch' ? 1 : .7, showRipple);
  }

  mark.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse' || event.pointerType === 'pen') pressPointer(event, true);
  });
  mark.addEventListener('pointermove', event => {
    pointer = event;
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      if (pointer) pressPointer(pointer);
    });
  });
  mark.addEventListener('pointerdown', event => pressPointer(event, true));
  mark.addEventListener('pointerup', event => {
    if (event.pointerType === 'touch') {
      // Keep a quick tap visible before releasing the virtual surface.
      cancelSequence();
      timers.push(setTimeout(release, 180));
    } else {
      pressPointer(event);
    }
  });
  mark.addEventListener('pointerleave', () => {
    cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    pointer = null;
    cancelSequence();
    timers.push(setTimeout(release, 150));
  });
  mark.addEventListener('pointercancel', stop);
  // Native button activation supports Enter, Space, and assistive technology.
  mark.addEventListener('click', event => {
    if (event.detail === 0) playTouchSequence();
  });
  mark.addEventListener('blur', stop);

  const observer = new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    if (!inView) stop();
    else if (!introduced && !document.hidden) {
      introduced = true;
      document.fonts.ready.then(playTouchSequence);
    }
  }, { threshold: .5 });
  observer.observe(mark);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });
  reducedMotion.addEventListener('change', stop);
})();
