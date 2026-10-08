(() => {
  "use strict";

  const FILE_SELECTOR = '[id^="diff-"][role="region"]';
  const KEYS = new Set(["j", "k", "x", " ", "p"]);
  const heldKeys = new Set();
  let selectedId = null;

  // Recheck the URL and DOM on each key: GitHub navigates without reloading.
  function isReviewPage() {
    return /^\/[^/]+\/[^/]+\/pull\/\d+\/(?:files|changes)(?:\/|$)/.test(location.pathname);
  }

  function isVisible(element) {
    return element.getClientRects().length > 0 && !element.closest('[hidden], [inert]');
  }

  function shouldIgnore(event) {
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.isComposing) return true;
    if (event.composedPath().some(element => element instanceof Element && (
      element.matches('input, textarea, select, [role="textbox"], [role="combobox"]') ||
      element.isContentEditable
    ))) return true;
    return [...document.querySelectorAll('dialog[open], [role="dialog"], [aria-modal="true"]')].some(isVisible);
  }

  function files() {
    return [...document.querySelectorAll(FILE_SELECTOR)].filter(isVisible);
  }

  function header(file) {
    return file.querySelector('[data-diff-header-wrapper]') || file;
  }

  function topOffset(file) {
    const offset = parseFloat(getComputedStyle(header(file)).getPropertyValue('--header-sticky-offset')) || 0;
    return Math.max(96, offset + 16);
  }

  function currentFile(list) {
    const selected = list.find(file => file.id === selectedId);
    if (selected) {
      const rect = selected.getBoundingClientRect();
      if (rect.bottom > topOffset(selected) && rect.top < innerHeight) return selected;
    }
    const focused = document.activeElement?.closest(FILE_SELECTOR);
    if (list.includes(focused)) {
      const rect = focused.getBoundingClientRect();
      if (rect.bottom > topOffset(focused) && rect.top < innerHeight) return focused;
    }
    // Use the file at the top of the viewport after manual scrolling.
    return list.find(file => file.getBoundingClientRect().bottom > topOffset(file)) || list.at(-1);
  }

  function select(file, scroll = false) {
    document.querySelectorAll('[data-review-vikeys-selected]').forEach(element => {
      element.removeAttribute('data-review-vikeys-selected');
    });
    selectedId = file.id;
    file.setAttribute('data-review-vikeys-selected', '');
    if (scroll) {
      file.style.scrollMarginTop = `${topOffset(file)}px`;
      file.scrollIntoView({ block: 'start', behavior: 'instant' });
      // Leave focus on the selected file, rather than a button in the previous one.
      if (!file.hasAttribute('tabindex')) file.setAttribute('tabindex', '-1');
      file.focus({ preventScroll: true });
    }
  }

  function accessibleLabel(button) {
    const direct = button.getAttribute('aria-label');
    if (direct) return direct.trim();
    return (button.getAttribute('aria-labelledby') || '').split(/\s+/)
      .map(id => document.getElementById(id)?.textContent || '').join(' ').trim();
  }

  function viewedButton(file) {
    return [...header(file).querySelectorAll('button[aria-pressed]')].find(button =>
      /^(?:Not Viewed|Viewed|Mark as viewed|Mark as not viewed)$/i.test(accessibleLabel(button))
    );
  }

  function collapseButton(file) {
    return [...header(file).querySelectorAll('button')].find(button =>
      /^(?:Collapse|Expand) file$/i.test(accessibleLabel(button))
    );
  }

  function reviewButton() {
    return [...document.querySelectorAll('button')].find(button =>
      isVisible(button) && /\bSubmit review/i.test(button.textContent)
    );
  }

  function intercept(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function onKeyDown(event) {
    if (!KEYS.has(event.key) || !isReviewPage() || shouldIgnore(event)) return;
    const list = files();
    if (!list.length) return;

    // Capture on window before document, React, or GitHub hotkey listeners.
    // Consume repeats too, but only navigation should repeat its action.
    intercept(event);
    heldKeys.add(event.code || event.key);
    if (event.repeat && event.key !== 'j' && event.key !== 'k') return;

    if (event.key === 'p') {
      const button = reviewButton();
      if (button && !button.disabled) button.click();
      return;
    }

    const current = currentFile(list);
    if (event.key === 'j' || event.key === 'k') {
      const next = Math.max(0, Math.min(list.length - 1, list.indexOf(current) + (event.key === 'j' ? 1 : -1)));
      select(list[next], true);
      return;
    }

    select(current);
    if (event.key === 'x') {
      const button = viewedButton(current);
      if (!button || button.disabled) return;
      const nextId = list[list.indexOf(current) + 1]?.id;
      if (button.getAttribute('aria-pressed') !== 'true') button.click();
      // Clicking Viewed can rerender the diff, so resolve the next file again.
      const next = nextId && files().find(file => file.id === nextId);
      if (next) select(next, true);
    } else if (event.key === ' ') {
      const button = collapseButton(current);
      if (button && !button.disabled) button.click();
    }
  }

  window.addEventListener('keydown', onKeyDown, true);
  // Some shortcuts listen to keypress/keyup. Keep ownership of the whole
  // keystroke even if clicking p moved focus into the review dialog.
  for (const type of ['keypress', 'keyup']) {
    window.addEventListener(type, event => {
      const key = event.code || event.key;
      if (!heldKeys.has(key)) return;
      intercept(event);
      if (type === 'keyup') heldKeys.delete(key);
    }, true);
  }
  window.addEventListener('blur', () => heldKeys.clear());
  window.addEventListener('pointerdown', event => {
    selectedId = event.target instanceof Element ? event.target.closest(FILE_SELECTOR)?.id || null : null;
  }, true);
  for (const type of ['wheel', 'touchmove']) {
    window.addEventListener(type, () => {
      selectedId = null;
      if (document.activeElement?.matches(`${FILE_SELECTOR}[data-review-vikeys-selected]`)) {
        document.activeElement.blur();
      }
    }, { passive: true });
  }
})();
