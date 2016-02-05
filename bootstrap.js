/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

// Bootstrap Addon Reason Constants:
const APP_STARTUP     = 1;
const APP_SHUTDOWN    = 2;
const ADDON_ENABLE    = 3;
const ADDON_DISABLE   = 4;
const ADDON_INSTALL   = 5;
const ADDON_UNINSTALL = 6;
const ADDON_UPGRADE   = 7;
const ADDON_DOWNGRADE = 8;

Cu.import("resource://gre/modules/Services.jsm");

/** @type   {WeakMap<Window, ContextSearch>} */
let gObjectMap = null;

/**
 * bootstrapped addon interfaces
 *
 * @param   {?}         aData
 * @param   {number}    aReason
 */
function startup(aData, aReason) {
  Cu.import("chrome://contextsearch/content/ContextSearch.jsm");
  gObjectMap = new WeakMap();

  const windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    const domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    SetupHelper.setup(domWindow);
  }

  Services.wm.addListener(WindowListener);
}

/**
 * @param   {?}         aData
 * @param   {number}    aReason
 */
function shutdown(aData, aReason) {
  Services.wm.removeListener(WindowListener);

  // if the application is shutdown time, we don't have to call these step.
  if (aReason === APP_SHUTDOWN) {
    return;
  }

  const windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    const domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    SetupHelper.teardown(domWindow);
  }

  gObjectMap = null;

  Cu.unload("chrome://contextsearch/content/ContextSearch.jsm");
}

/**
 * @param   {?}         aData
 * @param   {number}    aReason
 */
function install(aData, aReason) {
}

/**
 * @param   {?}         aData
 * @param   {number}    aReason
 */
function uninstall(aData, aReason) {
}

// nsIWindowMediatorListener
const WindowListener = {

  /**
   * @param {Window} aXulWindow
   */
  onOpenWindow : function (aXulWindow) {
    const domWindow = aXulWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                    .getInterface(Ci.nsIDOMWindow);

    // Wait finish loading
    domWindow.addEventListener("load", function onLoad(aEvent) {
      domWindow.removeEventListener("load", onLoad, false);

      SetupHelper.setup(domWindow, aEvent);
    }, false);
  },

  onCloseWindow : function (aXulWindow) {},

  onWindowTitleChange : function (aWindow, aNewTitle) {}
};

const SetupHelper = {

  /**
   * @param {Window} aDomWindow
   */
  setup: function (aDomWindow) {
    const windowType = aDomWindow.document.
                     documentElement.getAttribute("windowtype");
    // If this isn't a browser window then abort setup.
    if (windowType !== "navigator:browser") {
      return;
    }

    const contextsearch = new ContextSearch(aDomWindow);
    gObjectMap.set(aDomWindow, contextsearch);
  },

  /**
   * @param {Window} aDomWindow
   */
  teardown: function (aDomWindow) {
    const contextsearch = gObjectMap.get(aDomWindow);
    if (!!contextsearch) {
      contextsearch.finalize();
    }
  },

};
