/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var { classes: Cc, interfaces: Ci, utils: Cu } = Components;

// Bootstrap Addon Reason Constants:
var APP_STARTUP     = 1;
var APP_SHUTDOWN    = 2;
var ADDON_ENABLE    = 3;
var ADDON_DISABLE   = 4;
var ADDON_INSTALL   = 5;
var ADDON_UNINSTALL = 6;
var ADDON_UPGRADE   = 7;
var ADDON_DOWNGRADE = 8;

Cu.import("resource://gre/modules/Services.jsm");


/*
 * bootstrapped addon interfaces
 */
function startup(aData, aReason) {
  Cu.import("chrome://contextsearch/content/ContextSearch.jsm");

  let windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    SetupHelper.setup(domWindow);
  }

  Services.wm.addListener(WindowListener);
}

function shutdown(aData, aReason) {
  Services.wm.removeListener(WindowListener);

  // if the application is shutdown time, we don't have to call these step.
  if (aReason === APP_SHUTDOWN) {
    return;
  }

  let windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    SetupHelper.teardown(domWindow);
  }

  Cu.unload("chrome://contextsearch/content/ContextSearch.jsm");
}

function install(aData, aReason) {
}

function uninstall(aData, aReason) {
}

// nsIWindowMediatorListener
let WindowListener = {

  onOpenWindow : function (aXulWindow) {
    let domWindow = aXulWindow.QueryInterface(Ci.nsIInterfaceRequestor)
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

let SetupHelper = {

  setup: function (aDomWindow) {
    let windowType = aDomWindow.document.
                     documentElement.getAttribute("windowtype");
    // If this isn't a browser window then abort setup.
    if (windowType !== "navigator:browser") {
      return;
    }

    aDomWindow.ContextSearch = new ContextSearch(aDomWindow);
  },

  teardown: function (aDomWindow) {
    if (!!aDomWindow.ContextSearch.onUnLoad) {
      aDomWindow.ContextSearch.onUnLoad();
      delete aDomWindow.ContextSearch;
    }
  },

};
