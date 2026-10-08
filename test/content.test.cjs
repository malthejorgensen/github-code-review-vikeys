const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const source = fs.readFileSync('content.js', 'utf8');
const fixture = fs.readFileSync('github_code_review_individual_files.html', 'utf8') +
  fs.readFileSync('github_code_review_submit_review_button.html', 'utf8');

function setup() {
  const dom = new JSDOM(fixture, { url: 'https://github.com/example/repo/pull/1/files', runScripts: 'outside-only' });
  const { window } = dom;
  const { document } = window;
  const files = [...document.querySelectorAll('[id^="diff-"][role="region"]')];
  let scroll = 0;
  const positions = [100, 600];
  // jsdom has no layout: emulate two consecutive 500px file regions.
  window.Element.prototype.getClientRects = function () { return this.hidden ? [] : [{}]; };
  window.HTMLElement.prototype.scrollIntoView = function () { scroll = positions[files.indexOf(this)] - 96; };
  files.forEach((file, i) => {
    file.getBoundingClientRect = () => ({ top: positions[i] - scroll, bottom: positions[i] + 500 - scroll });
    const viewed = file.querySelector('button[aria-pressed]');
    viewed.addEventListener('click', () => {
      viewed.setAttribute('aria-pressed', viewed.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    });
    const collapse = file.querySelector('button');
    collapse.addEventListener('click', () => {
      const tooltip = document.getElementById(collapse.getAttribute('aria-labelledby'));
      tooltip.textContent = tooltip.textContent === 'Collapse file' ? 'Expand file' : 'Collapse file';
    });
  });
  window.eval(source);
  const nativeEvents = [];
  for (const type of ['keydown', 'keypress', 'keyup']) {
    window.addEventListener(type, event => nativeEvents.push(`window:${event.type}`), true);
    document.addEventListener(type, event => nativeEvents.push(`document:${event.type}`), true);
    document.addEventListener(type, event => nativeEvents.push(`bubble:${event.type}`));
  }
  function dispatch(key, type = 'keydown', options = {}, target = document.activeElement) {
    const event = new window.KeyboardEvent(type, {
      key, code: key === ' ' ? 'Space' : `Key${key.toUpperCase()}`, bubbles: true, cancelable: true, ...options,
    });
    target.dispatchEvent(event);
    return event;
  }
  function press(key, options, target) {
    const down = dispatch(key, 'keydown', options, target);
    dispatch(key, 'keypress', options, target);
    dispatch(key, 'keyup', options, target);
    return down;
  }
  return { dom, window, document, files, nativeEvents, dispatch, press, setScroll: value => { scroll = value; } };
}

test('j/k navigate adjacent fixture files and clamp at either end', () => {
  const s = setup();
  s.press('j');
  assert.equal(s.document.activeElement, s.files[1]);
  assert.ok(s.files[1].hasAttribute('data-review-vikeys-selected'));
  s.press('j');
  assert.equal(s.document.activeElement, s.files[1]);
  s.press('k');
  s.press('k');
  assert.equal(s.document.activeElement, s.files[0]);
  assert.equal(s.document.querySelectorAll('[data-review-vikeys-selected]').length, 1);
  assert.equal(s.files[0].style.scrollMarginTop, '96px');
  assert.deepEqual(s.nativeEvents, []);
  s.dom.window.close();
});

test('x marks viewed and advances, stays at the last file, and suppresses held-key repeats', () => {
  const s = setup();
  const viewed = s.files[0].querySelector('button[aria-pressed]');
  s.press('x');
  assert.equal(viewed.getAttribute('aria-pressed'), 'true');
  assert.equal(s.document.activeElement, s.files[1]);
  assert.equal(s.files[1].querySelector('button[aria-pressed]').getAttribute('aria-pressed'), 'false');
  s.dispatch('x', 'keydown', { repeat: true });
  s.dispatch('x', 'keyup');
  assert.equal(s.files[1].querySelector('button[aria-pressed]').getAttribute('aria-pressed'), 'false');
  s.press('x');
  s.press('x');
  assert.equal(s.files[1].querySelector('button[aria-pressed]').getAttribute('aria-pressed'), 'true');
  assert.equal(s.document.activeElement, s.files[1]);
  s.press('k');
  s.press('x');
  assert.equal(viewed.getAttribute('aria-pressed'), 'true');
  assert.equal(s.document.activeElement, s.files[1]);
  assert.deepEqual(s.nativeEvents, []);
  s.dom.window.close();
});

test('Space clicks collapse and expand without toggling on held-key repeats', () => {
  const s = setup();
  const tooltip = s.document.getElementById(s.files[0].querySelector('button').getAttribute('aria-labelledby'));
  s.press(' ');
  assert.equal(tooltip.textContent, 'Expand file');
  s.dispatch(' ', 'keydown', { repeat: true });
  assert.equal(tooltip.textContent, 'Expand file');
  s.dispatch(' ', 'keyup');
  s.press(' ');
  assert.equal(tooltip.textContent, 'Collapse file');
  assert.deepEqual(s.nativeEvents, []);
  s.dom.window.close();
});

test('p opens review; keypress/keyup stay intercepted when focus moves to its textarea', () => {
  const s = setup();
  let clicks = 0;
  s.document.querySelector('button[data-variant="primary"]').addEventListener('click', () => {
    clicks++;
    const dialog = s.document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.innerHTML = '<textarea></textarea>';
    s.document.body.append(dialog);
    dialog.firstChild.focus();
  });
  assert.equal(s.press('p').defaultPrevented, true);
  assert.equal(clicks, 1);
  assert.deepEqual(s.nativeEvents, []);
  assert.equal(s.press('j').defaultPrevented, false);
  assert.equal(s.document.querySelector('[data-review-vikeys-selected]'), null);
  s.dom.window.close();
});

test('typing, modifiers, composition, other keys, and open dialogs keep normal behavior', () => {
  const s = setup();
  for (const html of ['<input>', '<textarea></textarea>', '<select></select>', '<div role="textbox" tabindex="0"></div>', '<div contenteditable="true" tabindex="0"></div>']) {
    const wrapper = s.document.createElement('div');
    wrapper.innerHTML = html;
    const input = wrapper.firstChild;
    // jsdom does not implement isContentEditable.
    if (input.hasAttribute('contenteditable')) Object.defineProperty(input, 'isContentEditable', { value: true });
    s.document.body.append(wrapper);
    input.focus();
    for (const key of ['j', 'k', 'x', ' ', 'p']) assert.equal(s.press(key).defaultPrevented, false);
    wrapper.remove();
  }
  for (const modifier of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey', 'isComposing']) {
    assert.equal(s.press('j', { [modifier]: true }).defaultPrevented, false);
  }
  assert.equal(s.press('q').defaultPrevented, false);
  const dialog = s.document.createElement('dialog');
  dialog.setAttribute('open', '');
  s.document.body.append(dialog);
  assert.equal(s.press('x').defaultPrevented, false);
  assert.equal(s.files[0].querySelector('button[aria-pressed]').getAttribute('aria-pressed'), 'false');
  assert.ok(s.nativeEvents.length > 0);
  s.dom.window.close();
});

test('click and manual scroll select the intended file, including collapsed files', () => {
  const s = setup();
  s.files[1].dispatchEvent(new s.window.Event('pointerdown', { bubbles: true }));
  s.press('x');
  assert.equal(s.files[1].querySelector('button[aria-pressed]').getAttribute('aria-pressed'), 'true');
  s.window.dispatchEvent(new s.window.Event('wheel'));
  s.setScroll(510);
  s.press(' ');
  const tooltip = s.document.getElementById(s.files[1].querySelector('button').getAttribute('aria-labelledby'));
  assert.equal(tooltip.textContent, 'Expand file');
  assert.equal(s.files[0].querySelector('button[aria-pressed]').getAttribute('aria-pressed'), 'false');
  s.dom.window.close();
});

test('SPA navigation, DOM replacement, and empty review pages are handled without reinjection', () => {
  const s = setup();
  s.window.history.pushState({}, '', '/example/repo/issues');
  assert.equal(s.press('j').defaultPrevented, false);
  s.window.history.pushState({}, '', '/example/repo/pull/2/changes');
  assert.equal(s.press('j').defaultPrevented, true);
  const replacement = s.files[1].cloneNode(true);
  replacement.getBoundingClientRect = s.files[1].getBoundingClientRect;
  s.files[1].replaceWith(replacement);
  let clicks = 0;
  replacement.querySelector('button[aria-pressed]').addEventListener('click', () => clicks++);
  s.press('x');
  assert.equal(clicks, 1);
  s.document.body.innerHTML = '';
  assert.equal(s.press('j').defaultPrevented, false);
  s.dom.window.close();
});

test('manifest injects capture handler at document_start across GitHub SPA entry points', () => {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.content_scripts[0].run_at, 'document_start');
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://github.com/*']);
  for (const path of [...manifest.content_scripts[0].js, ...manifest.content_scripts[0].css]) {
    assert.ok(fs.existsSync(path));
  }
});
