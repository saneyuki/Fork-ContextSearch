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

function ContextSearch(aWindow) {
  this.window = aWindow;

  this.searchEnginesMap = new WeakMap();
  this._isEnabledTreeStyleTab = false;
  this.prefBranch = Services.prefs.getBranch(PREF_BRANCH_NAME);
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
      this.rebuildmenu();
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

    this.ctxPopup = document.getElementById("context-searchpopup");
    this.ctxMenu = document.getElementById("context-searchmenu");

    document.getElementById("contentAreaContextMenu").addEventListener("popupshowing", this, false);
    this.ctxPopup.addEventListener("command", this, false);

    this.rebuildmenu();

    let accesskey = window.gNavigatorBundle.getString("contextMenuSearch.accesskey");
    this.ctxMenu.setAttribute("accesskey", accesskey);

    // hide default search menu.
    if (this.prefBranch.getBoolPref("hideStandardContextItem")) {
      document.getElementById("context-searchselect").style.display = "none";
    }
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

  rebuildmenu: function () {
    let popup = this.ctxPopup;
    let engines = Services.search.getVisibleEngines({});
    let document = this.window.document;

    // clear menu
    let range = document.createRange();
    range.selectNodeContents(popup);
    range.deleteContents();

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
      popup.appendChild(menuitem);
    }
  },

  onCommand: function (aEvent) {
    this.search(aEvent);
  },

  search: function (aEvent) {
    let target = aEvent.target;
    let enginesMap = this.searchEnginesMap;
    if (!enginesMap.has(target)) {
      return;
    }

    let loadInBackground = Services.prefs.
                           getBoolPref("browser.search.context.loadInBackground");
    let where            = loadInBackground ? "tabshifted" : "tab";
    let selectedText     = this.window.gContextMenu.textSelected;
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

    let openLinkIn = this.window.openLinkIn;
    if (this._isEnabledTreeStyleTab &&
        this.prefBranch.getBoolPref("treestyletab.searchResultAsChildren") ) {
      let TreeStyleTabService = this.window.TreeStyleTabService;
      TreeStyleTabService.readyToOpenChildTab();
      openLinkIn(searchUrl, where, params);
      TreeStyleTabService.stopToOpenChildTab();
    }
    else {
      openLinkIn(searchUrl, where, params);
    }

    this.window.BrowserSearch.recordSearchInHealthReport(engine.name, "contextmenu");
  },

};
