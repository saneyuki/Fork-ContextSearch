/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { interfaces: Ci, utils: Cu } = Components;

// Bootstrap Addon Reason Constants:
//const APP_STARTUP = 1;
const APP_SHUTDOWN = 2;
//const ADDON_ENABLE = 3;
//const ADDON_DISABLE = 4;
//const ADDON_INSTALL = 5;
//const ADDON_UNINSTALL = 6;
//const ADDON_UPGRADE = 7;
//const ADDON_DOWNGRADE = 8;

const {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

/** @type   {WeakMap<Window, ContextSearch>} */
let gObjectMap = null;
let ContextSearchConstructor = null;
let gWebExtBrowser = null;

const SetupHelper = {

  /**
   * @param {Window} aDomWindow
   * @returns {void}
   */
  setup: function (aDomWindow) {
    const windowType = aDomWindow.document.
                     documentElement.getAttribute("windowtype");
    // If this isn't a browser window then abort setup.
    if (windowType !== "navigator:browser") {
      return;
    }

    const contextsearch = new ContextSearchConstructor(aDomWindow, gWebExtBrowser);
    gObjectMap.set(aDomWindow, contextsearch);
  },

  /**
   * @param {Window} aDomWindow
   * @returns {void}
   */
  teardown: function (aDomWindow) {
    const contextsearch = gObjectMap.get(aDomWindow);
    if (!!contextsearch) {
      contextsearch.finalize();
    }
  },

};

// nsIWindowMediatorListener
const WindowListener = {

  /**
   * @param {Window} aXulWindow
   * @returns {void}
   */
  onOpenWindow : function (aXulWindow) {
    const domWindow = aXulWindow.QueryInterface(Ci.nsIInterfaceRequestor) // eslint-disable-line new-cap
                    .getInterface(Ci.nsIDOMWindow);

    // Wait finish loading
    domWindow.addEventListener("load", function onLoad(aEvent) {
      domWindow.removeEventListener("load", onLoad, false);

      SetupHelper.setup(domWindow, aEvent);
    }, false);
  },

  onCloseWindow(/* aXulWindow */) {}, // eslint-disable-line no-empty-function

  onWindowTitleChange(/* aWindow, aNewTitle */) {} // eslint-disable-line no-empty-function
};

/**
 * bootstrapped addon interfaces
 *
 * @param   {?}         aData
 * @param   {number}    aReason
 * @returns {void}
 */
function startup({ webExtension }, aReason) { // eslint-disable-line no-unused-vars
  const { ContextSearch } = Cu.import("chrome://contextsearch/content/ContextSearch.js", {});
  ContextSearchConstructor = ContextSearch;
  gObjectMap = new WeakMap();

  webExtension.startup().then((api) => {
    const { browser } = api;
    gWebExtBrowser = browser;

    const windows = Services.wm.getEnumerator("navigator:browser");
    while (windows.hasMoreElements()) {
      const domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow); // eslint-disable-line new-cap
      SetupHelper.setup(domWindow);
    }

    Services.wm.addListener(WindowListener);
  });
}

/**
 * @param   {?}         aData
 * @param   {number}    aReason
 * @returns {void}
 */
function shutdown(aData, aReason) { // eslint-disable-line no-unused-vars
  Services.wm.removeListener(WindowListener);

  // if the application is shutdown time, we don't have to call these step.
  if (aReason === APP_SHUTDOWN) {
    return;
  }

  const windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    const domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow); // eslint-disable-line new-cap
    SetupHelper.teardown(domWindow);
  }

  gWebExtBrowser = null;
  gObjectMap = null;

  Cu.unload("chrome://contextsearch/content/ContextSearch.js");
}

/**
 * @param   {?}         aData
 * @param   {number}    aReason
 * @returns {void}
 */
function install(aData, aReason) { // eslint-disable-line no-unused-vars
}

/**
 * @param   {?}         aData
 * @param   {number}    aReason
 * @returns {void}
 */
function uninstall(aData, aReason) { // eslint-disable-line no-unused-vars
}
