const { session, dialog } = require('electron');
const state = require('./state');

// always fine
const ALLOW = new Set(['fullscreen', 'clipboard-sanitized-write', 'pointerLock']);
// ask first; anything not listed in either set is denied
const ASK = {
  media: 'use your camera or microphone',
  geolocation: 'know your location',
  notifications: 'show notifications',
  'clipboard-read': 'read your clipboard'
};

const decisions = new Map(); // "origin|permission" -> true/false (remembered until Macha quits)
const pending = new Map(); // same key -> promise, so one site never stacks two dialogs

function ask(key, host, what) {
  if (!pending.has(key)) {
    const opts = {
      type: 'question',
      buttons: ['Allow', 'Block'],
      defaultId: 1,
      cancelId: 1,
      message: `${host} wants to ${what}`,
      detail: 'Restart Macha to be asked again.'
    };
    const { win } = state;
    const shown = win && !win.isDestroyed() ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts);
    pending.set(
      key,
      shown.then(({ response }) => {
        decisions.set(key, response === 0);
        pending.delete(key);
        return response === 0;
      })
    );
  }
  return pending.get(key);
}

function registerPermissions() {
  const ses = session.defaultSession;

  ses.setPermissionCheckHandler(
    (_wc, permission, origin) => ALLOW.has(permission) || decisions.get(`${origin}|${permission}`) === true
  );

  ses.setPermissionRequestHandler(async (_wc, permission, callback, details) => {
    if (ALLOW.has(permission)) return callback(true);
    let origin;
    try {
      origin = new URL(details.requestingUrl).origin;
    } catch {
      return callback(false);
    }
    if (!Object.hasOwn(ASK, permission) || origin === 'null') return callback(false);
    const key = `${origin}|${permission}`;
    if (decisions.has(key)) return callback(decisions.get(key));
    callback(await ask(key, new URL(origin).host, ASK[permission]));
  });
}

module.exports = { registerPermissions };
