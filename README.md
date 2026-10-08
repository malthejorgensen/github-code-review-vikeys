# GitHub Code Review Vi Keys

A Chrome Manifest V3 extension for GitHub pull request **Files changed** pages (both `/files` and `/changes`).

## Install

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select this repository directory.
3. Reload any GitHub tabs already open.

## Shortcuts

| Key | Action |
| --- | --- |
| `j` | Move to the next file |
| `k` | Move to the previous file |
| `x` | Toggle viewed status: marking viewed advances to the next file; marking not viewed stays on the current file |
| Space | Collapse or expand the current file |
| `p` | Open GitHub's Submit review dialog |

The current file is determined from focus, a click in a diff, or the top of the viewport. Navigation stops at the first/last file. A blue accent marks the selected file header. Hold `j`/`k` to keep moving.

Shortcuts are paused while typing, while a dialog is open, and when modifier keys are held. The extension clicks GitHub's own controls to preserve its normal saved state and behavior. It opens the review dialog; submit your review using GitHub's controls.

The keyboard listener registers on `window` in capture phase at `document_start`, preventing default actions and stopping propagation for handled keys, including keypress/keyup. The script loads throughout github.com so it also works when GitHub navigates into a pull request without a full reload; shortcuts activate only on review pages with rendered diff files. It needs no additional permissions, background service, or build step.

## Development

Run `npm install` and `npm test`. Tests use the supplied HTML fixtures and simulate GitHub's control handlers and keyboard listeners. Live GitHub behavior can change if GitHub changes its markup.
