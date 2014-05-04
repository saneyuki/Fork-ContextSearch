/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

let EXPORTED_SYMBOLS = ["ContextSearch"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

const PREF_BRANCH_NAME = "extensions.contextsearch.";

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Promise.jsm");

XPCOMUtils.defineLazyGetter(this, "gPrefBranch", function () {
  return Services.prefs.getBranch(PREF_BRANCH_NAME);
});

function ContextSearch(aWindow) {
  this.window = aWindow;

  this.searchEnginesMap = new WeakMap();
  this._isEnabledTreeStyleTab = false;
  this.ctxPopup = null;
  this.ctxMenu = null;

  Services.obs.addObserver(this, "browser-search-engine-modified", true);
  aWindow.addEventListener("load", this, false);
}
ContextSearch.prototype = {

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                         Ci.nsIDOMEventListener,
                                         Ci.nsISupportsWeakReference,
                                         Ci.nsISupports]),

  observe: function (aSubject, aTopic, aData) {
    if (aTopic === "browser-search-engine-modified") {
      this.rebuildEngineMenu(this.ctxPopup);
    }
  },

  handleEvent: function (aEvent) {
    switch (aEvent.type) {
      case "load":
        this.onLoad();
        break;
      case "popupshowing":
        this.onPopup(aEvent);
        break;
      case "unload":
        this.onUnLoad();
        break;
      case "command":
        this.onCommand(aEvent);
        break;
    }
  },

  onLoad: function () {
    let window = this.window;
    let document = window.document;

    window.removeEventListener("load", this, false);
    window.addEventListener("unload", this, false);

    this._isEnabledTreeStyleTab = ("TreeStyleTabService" in window) ? true : false;

    initSearchService(() => {
      [this.ctxPopup, this.ctxMenu] = this.createMenu();
    });
  },

  createMenu: function () {
    let window = this.window;
    let document = window.document;

    let popup = document.createElement("menupopup");
    popup.setAttribute("id", "context-searchpopup");
    popup.addEventListener("command", this, false);
    this.rebuildEngineMenu(popup);

    let menu = document.createElement("menu");
    menu.setAttribute("id", "context-searchmenu");
    let accesskey = window.gNavigatorBundle.getString("contextMenuSearch.accesskey");
    menu.setAttribute("accesskey", accesskey);

    menu.appendChild(popup);

    let ctxMenu = document.getElementById("contentAreaContextMenu");
    let insertionPoint = document.getElementById("context-searchselect");
    ctxMenu.insertBefore(menu, insertionPoint.nextSibling);
    ctxMenu.addEventListener("popupshowing", this, false);

    // hide default search menu.
    if (gPrefBranch.getBoolPref("hideStandardContextItem")) {
      insertionPoint.style.display = "none";
    }

    return [popup, menu];
  },

  onUnLoad: function () {
    let window = this.window;
    let document = window.document;

    window.removeEventListener("unload", this, false);

    document.getElementById("contentAreaContextMenu").removeEventListener("popupshowing", this, false);
    this.ctxPopup.removeEventListener("command", this, false);

    Services.obs.removeObserver(this, "browser-search-engine-modified");

    // Release DOM reference
    this.ctxMenu  = null;
    this.ctxPopup = null;
  },

  onPopup: function(aEvent) {
    if (aEvent.target.id !== "contentAreaContextMenu") {
      return;
    }

    let ctxMenu = this.ctxMenu;
    let gContextMenu = this.window.gContextMenu;
    // truncate text for label and set up menu items as appropriate
    if (gContextMenu.isTextSelected) {
      let selectedText = gContextMenu.textSelected;
      if (selectedText.length > 15) {
        selectedText = selectedText.substr(0,15) + "...";
      }

      let menuLabel = this.getMenuItemLabel(selectedText);
      ctxMenu.setAttribute("label", menuLabel);
      ctxMenu.removeAttribute("hidden");
    }
    else {
      ctxMenu.setAttribute("hidden", "true");
    }
  },

  // shamelessly ripped from browser.js
  getMenuItemLabel: function (aString) {
    let engineName = "";

    // format "Search <engine> for <selection>" string to show in menu
    let menuLabel = this.window.gNavigatorBundle.getFormattedString("contextMenuSearch", [engineName, aString]);
    return menuLabel.replace(/\s\s/, " ");
  },

  rebuildEngineMenu: function (aPopup) {
    let engines = Services.search.getVisibleEngines({});
    let document = this.window.document;

    // clear menu
    let range = document.createRange();
    range.selectNodeContents(aPopup);
    range.deleteContents();

    let fragment = document.createDocumentFragment();
    for (let i = 0, l = engines.length; i < l; i++) {
      let engine   = engines[i];
      let menuitem = document.createElement("menuitem");
      let name     = engine.name;
      menuitem.setAttribute("id", "contextsearch-engine:" + encodeURIComponent(name));
      menuitem.setAttribute("label", name);
      menuitem.setAttribute("class", "menuitem-iconic contextsearch-menuitem");

      if (engine.iconURI) {
        menuitem.setAttribute("image", engine.iconURI.spec);
      }

      this.searchEnginesMap.set(menuitem, engine);
      fragment.appendChild(menuitem);
    }
    aPopup.appendChild(fragment);
  },

  onCommand: function (aEvent) {
    this.search(aEvent);
  },

  search: function (aEvent) {
    let window = this.window;
    let target = aEvent.target;
    let enginesMap = this.searchEnginesMap;
    if (!enginesMap.has(target)) {
      return;
    }

    let loadInBackground = Services.prefs.
                           getBoolPref("browser.search.context.loadInBackground");
    let where            = loadInBackground ? "tabshifted" : "tab";
    let selectedText     = window.gContextMenu.textSelected;
    let engine           = enginesMap.get(target);
    let searchSubmission = engine.getSubmission(selectedText, null, "contextmenu");

    // getSubmission can return null if the engine doesn't have a URL
    // with a text/html response type.
    if (!searchSubmission) {
      return;
    }

    let searchUrl = searchSubmission.uri.spec;
    let postData = searchSubmission.postData;

    let params = {
      fromChrome: true,
      postData: postData,
      relatedToCurrent: true,
    };

    let openLinkIn = window.openLinkIn;
    if (this._isEnabledTreeStyleTab &&
        gPrefBranch.getBoolPref("treestyletab.searchResultAsChildren") ) {
      let TreeStyleTabService = window.TreeStyleTabService;
      TreeStyleTabService.readyToOpenChildTab();
      openLinkIn(searchUrl, where, params);
      TreeStyleTabService.stopToOpenChildTab();
    }
    else {
      openLinkIn(searchUrl, where, params);
    }

    window.BrowserSearch.recordSearchInHealthReport(engine.name, "contextmenu");
  },

};


function initSearchService (aCallback) {
  Services.search.init({
    onInitComplete: function () {
      aCallback();
    }
  });
};
