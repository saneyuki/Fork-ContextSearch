/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const EXPORTED_SYMBOLS = ["ContextSearch"]; // eslint-disable-line no-unused-vars

const Ci = Components.interfaces;
const Cu = Components.utils;

const { XPCOMUtils } = Cu.import("resource://gre/modules/XPCOMUtils.jsm", {});
const { Services } = Cu.import("resource://gre/modules/Services.jsm", {});

/**
 *  @constructor
 *  @param    {Window}  aWindow
 */
function ContextSearch(aWindow) {
  /**  @type    {Window} */
  this.window = aWindow;

  /**  @type    {WeakMap<K, V>} */
  this.searchEnginesMap = new WeakMap();
  /**  @type    {boolean} */
  this._isEnabledTreeStyleTab = false;
  /**  @type    {string} */
  this._searchTerm = "";
  /**  @type    {Element} */
  this.ctxPopup = null;
  /**  @type    {Element} */
  this.ctxMenu = null;

  Object.seal(this);

  this.initialize();
}
ContextSearch.prototype = Object.freeze({

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                         Ci.nsIDOMEventListener,
                                         Ci.nsISupportsWeakReference,
                                         Ci.nsISupports]),

  /**
   *  @param    {nsISupports}   aSubject
   *  @param    {string}        aTopic
   *  @param    {wstring}   	aData
   *  @returns  {void}
   */
  observe: function (aSubject, aTopic/*, aData*/) {
    if (aTopic === "browser-search-engine-modified" &&
        this.ctxMenu !== null &&
        this.ctxPopup !== null) {
      this.rebuildEngineMenu(this.ctxPopup);
    }
  },

  /**
   *  @param    {Event} aEvent
   *  @returns  {void}
   */
  handleEvent: function (aEvent) {
    switch (aEvent.type) {
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

  /**
   *  @returns  {void}
   */
  initialize: function () {
    const window = this.window;

    window.addEventListener("unload", this, false);

    Services.obs.addObserver(this, "browser-search-engine-modified", true);
    this._isEnabledTreeStyleTab = ("TreeStyleTabService" in window);

    initSearchService(() => {
      [this.ctxPopup, this.ctxMenu] = this.createMenu();
    });
  },

  /**
   *  @returns  {[Element, Element]}
   */
  createMenu: function () {
    const window = this.window;
    const document = window.document;

    const popup = document.createElement("menupopup");
    popup.setAttribute("id", "context-searchpopup");
    popup.addEventListener("command", this, false);
    this.rebuildEngineMenu(popup);

    const menu = document.createElement("menu");
    menu.setAttribute("id", "context-searchmenu");
    const accesskey = window.gNavigatorBundle.getString("contextMenuSearch.accesskey");
    menu.setAttribute("accesskey", accesskey);

    menu.appendChild(popup);

    const ctxMenu = document.getElementById("contentAreaContextMenu");
    const insertionPoint = document.getElementById("context-searchselect");
    ctxMenu.insertBefore(menu, insertionPoint.nextSibling);
    ctxMenu.addEventListener("popupshowing", this, false);

    // hide default search menu.
    insertionPoint.style.display = "none";

    return [popup, menu];
  },

  /**
   *  @returns  {void}
   */
  finalize: function () {
    const window = this.window;
    const document = window.document;

    window.removeEventListener("unload", this, false);

    document.getElementById("contentAreaContextMenu").removeEventListener("popupshowing", this, false);
    this.ctxPopup.removeEventListener("command", this, false);

    Services.obs.removeObserver(this, "browser-search-engine-modified");

    // restore hidden default search menu.
    document.getElementById("context-searchselect").style.display = "";

    this.ctxMenu.removeChild(this.ctxPopup);
    this.ctxMenu.parentNode.removeChild(this.ctxMenu);

    // Release DOM reference
    this.ctxPopup = null;
    this.ctxMenu = null;
    this.window = null;
  },

  /**
   *  @returns  {void}
   */
  onUnLoad: function () {
    this.finalize();
  },

  /**
   *  @param    {Event} aEvent
   *  @returns  {void}
   */
  onPopup: function(aEvent) {
    if (aEvent.target.id !== "contentAreaContextMenu") {
      return;
    }

    const ctxMenu = this.ctxMenu;
    const gContextMenu = this.window.gContextMenu;
    // truncate text for label and set up menu items as appropriate
    const isTextSelected = gContextMenu.isTextSelected;
    const showSearchSelect = (isTextSelected || gContextMenu.onLink) && !gContextMenu.onImage;
    if (showSearchSelect) {
      let selectedText = isTextSelected ?
                            gContextMenu.textSelected :
                            gContextMenu.linkTextStr; // in the case of gContextMenu.onLink

      this._searchTerm = selectedText;
      if (selectedText.length > 15) {
        selectedText = selectedText.substr(0, 15) + "...";
      }

      const menuLabel = this.getMenuItemLabel(selectedText);
      ctxMenu.setAttribute("label", menuLabel);
      ctxMenu.removeAttribute("hidden");
    }
    else {
      ctxMenu.setAttribute("hidden", "true");
    }
  },

  /**
   *  shamelessly ripped from browser.jsm
   *
   *  @param    {string}    aString
   *  @returns  {string}
   */
  getMenuItemLabel: function (aString) {
    const engineName = "";

    // format "Search <engine> for <selection>" string to show in menu
    const menuLabel = this.window.gNavigatorBundle.getFormattedString("contextMenuSearch", [engineName, aString]);
    return menuLabel.replace(/\s\s/, " ");
  },

  /**
   *  @param    {Element}    aPopup
   *  @returns  {void}
   */
  rebuildEngineMenu: function (aPopup) {
    const engines = Services.search.getVisibleEngines({});
    const document = this.window.document;

    // clear menu
    const range = document.createRange();
    range.selectNodeContents(aPopup);
    range.deleteContents();

    const fragment = document.createDocumentFragment();
    for (let i = 0, l = engines.length; i < l; i++) {
      const engine = engines[i];
      const menuitem = document.createElement("menuitem");
      const name = engine.name;
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

  /**
   *  @param    {Event} aEvent
   *  @returns  {void}
   */
  onCommand: function (aEvent) {
    this.search(aEvent);
  },

  /**
   *  @param    {Event} aEvent
   *  @returns  {void}
   */
  search: function (aEvent) {
    const window = this.window;
    const target = aEvent.target;
    const enginesMap = this.searchEnginesMap;
    if (!enginesMap.has(target)) {
      return;
    }

    const loadInBackground = Services.prefs.
                           getBoolPref("browser.search.context.loadInBackground");
    const where = loadInBackground ? "tabshifted" : "tab";
    const selectedText = this._searchTerm;
    const engine = enginesMap.get(target);
    const searchSubmission = engine.getSubmission(selectedText, null, "contextmenu");

    // getSubmission can return null if the engine doesn't have a URL
    // with a text/html response type.
    if (!searchSubmission) {
      return;
    }

    const searchUrl = searchSubmission.uri.spec;
    const postData = searchSubmission.postData;

    const params = {
      fromChrome: true,
      postData: postData,
      relatedToCurrent: true,
    };

    const openLinkIn = window.openLinkIn;
    if (this._isEnabledTreeStyleTab) {
      const TreeStyleTabService = window.TreeStyleTabService;
      TreeStyleTabService.readyToOpenChildTab();
      openLinkIn(searchUrl, where, params);
      TreeStyleTabService.stopToOpenChildTab();
    }
    else {
      openLinkIn(searchUrl, where, params);
    }

    window.BrowserSearch.recordSearchInTelemetry(engine, "contextmenu");
  },

});
this.ContextSearch = ContextSearch; // eslint-disable-line no-invalid-this


/**
 *  @param      {!function():void}  aCallback
 *  @returns    {void}
 */
function initSearchService(aCallback) {
  Services.search.init({
    onInitComplete: function () {
      aCallback();
    }
  });
}
