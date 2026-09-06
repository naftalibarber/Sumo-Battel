// Mobile/touch support for Sumo Battle.
// Keeps the main game engine unchanged and translates touch input to the
// keyboard/mouse input the p5 sketch already understands.
(function () {
  'use strict';

  const coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const hasTouch = coarsePointer || navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  if (!hasTouch) return;

  document.body.classList.add('touch-device');

  const controls = document.createElement('div');
  controls.id = 'touch-controls';
  controls.setAttribute('aria-label', 'פקדי מגע');
  controls.innerHTML = `
    <div id="touch-dpad" aria-label="תנועה">
      <button id="touch-up" type="button" aria-label="למעלה">▲</button>
      <button id="touch-left" type="button" aria-label="שמאלה">◀</button>
      <button id="touch-down" type="button" aria-label="למטה">▼</button>
      <button id="touch-right" type="button" aria-label="ימינה">▶</button>
    </div>
    <div id="touch-actions">
      <button id="touch-restart" type="button">↺ מחדש</button>
      <button id="touch-menu" type="button">☰ תפריט</button>
    </div>
  `;
  document.body.appendChild(controls);

  const downKeys = new Set();
  const keyInfo = {
    left:  { key: 'ArrowLeft',  code: 'ArrowLeft',  keyCode: 37 },
    up:    { key: 'ArrowUp',    code: 'ArrowUp',    keyCode: 38 },
    right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
    down:  { key: 'ArrowDown',  code: 'ArrowDown',  keyCode: 40 },
    enter: { key: 'Enter',      code: 'Enter',      keyCode: 13 },
    space: { key: ' ',          code: 'Space',      keyCode: 32 }
  };

  function dispatchKey(type, info) {
    const canvas = document.querySelector('canvas');
    if (canvas && typeof canvas.focus === 'function') canvas.focus({ preventScroll: true });

    const ev = new KeyboardEvent(type, {
      key: info.key,
      code: info.code,
      bubbles: true,
      cancelable: true,
      repeat: false
    });

    // p5.js reads which/keyCode in some browsers. Preserve them on synthetic input.
    try { Object.defineProperty(ev, 'keyCode', { get: () => info.keyCode }); } catch (_) {}
    try { Object.defineProperty(ev, 'which', { get: () => info.keyCode }); } catch (_) {}
    window.dispatchEvent(ev);
  }

  function press(name, button) {
    const info = keyInfo[name];
    if (!info || downKeys.has(name)) return;
    downKeys.add(name);
    if (button) button.classList.add('is-pressed');
    dispatchKey('keydown', info);
  }

  function release(name, button) {
    const info = keyInfo[name];
    if (!info || !downKeys.has(name)) return;
    downKeys.delete(name);
    if (button) button.classList.remove('is-pressed');
    dispatchKey('keyup', info);
  }

  function tap(name) {
    const info = keyInfo[name];
    if (!info) return;
    dispatchKey('keydown', info);
    window.setTimeout(() => dispatchKey('keyup', info), 35);
  }

  const directionButtons = [
    ['touch-up', 'up'],
    ['touch-left', 'left'],
    ['touch-down', 'down'],
    ['touch-right', 'right']
  ];

  directionButtons.forEach(([id, name]) => {
    const button = document.getElementById(id);
    if (!button) return;

    const start = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.setPointerCapture && event.pointerId != null) {
        try { button.setPointerCapture(event.pointerId); } catch (_) {}
      }
      press(name, button);
    };

    const end = (event) => {
      event.preventDefault();
      event.stopPropagation();
      release(name, button);
    };

    button.addEventListener('pointerdown', start);
    button.addEventListener('pointerup', end);
    button.addEventListener('pointercancel', end);
    button.addEventListener('lostpointercapture', end);
    button.addEventListener('contextmenu', e => e.preventDefault());
  });

  const menuButton = document.getElementById('touch-menu');
  const restartButton = document.getElementById('touch-restart');

  if (menuButton) {
    menuButton.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      tap('space');
    });
  }

  if (restartButton) {
    restartButton.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      tap('enter');
    });
  }

  // Convert taps on the scaled canvas to mouse presses. This makes the existing
  // canvas menu, bot selection, time selection and bracket buttons work on touch.
  function installCanvasTouchBridge() {
    const canvas = document.querySelector('canvas');
    if (!canvas || canvas.dataset.touchBridgeInstalled === '1') return;
    canvas.dataset.touchBridgeInstalled = '1';

    canvas.addEventListener('touchstart', event => {
      if (!event.touches || !event.touches.length) return;
      const touch = event.touches[0];
      event.preventDefault();

      const down = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
        buttons: 1
      });
      canvas.dispatchEvent(down);

      const up = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
        buttons: 0
      });
      window.setTimeout(() => canvas.dispatchEvent(up), 20);
    }, { passive: false });
  }

  function releaseAllDirections() {
    directionButtons.forEach(([id, name]) => release(name, document.getElementById(id)));
  }

  function syncControls() {
    installCanvasTouchBridge();

    let state = '';
    let stateObj = null;
    try {
      state = gameState;
      stateObj = STATE;
    } catch (_) {
      requestAnimationFrame(syncControls);
      return;
    }

    const movingStates = new Set([
      stateObj.SURVIVAL,
      stateObj.TOURNAMENT,
      stateObj.TIMEATTACK,
      stateObj.KING,
      stateObj.POTATO
    ]);

    const terminalStates = new Set([
      stateObj.GAMEOVER,
      stateObj.WIN,
      stateObj.SPECTATING
    ]);

    const canMove = movingStates.has(state);
    const showActions = canMove || terminalStates.has(state);

    controls.classList.toggle('is-visible', showActions);
    const dpad = document.getElementById('touch-dpad');
    if (dpad) dpad.hidden = !canMove;
    if (restartButton) restartButton.hidden = !terminalStates.has(state);
    if (menuButton) menuButton.hidden = !showActions;

    if (!canMove) releaseAllDirections();

    const isHebrew = document.documentElement.lang !== 'en';
    if (menuButton) menuButton.textContent = isHebrew ? '☰ תפריט' : '☰ Menu';
    if (restartButton) restartButton.textContent = isHebrew ? '↺ מחדש' : '↺ Restart';

    requestAnimationFrame(syncControls);
  }

  window.addEventListener('blur', releaseAllDirections);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAllDirections();
  });

  requestAnimationFrame(syncControls);
})();
