/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

var ContextSearch = {

	QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIObserver,
	                                       Components.interfaces.nsIDOMEventListener,
	                                       Components.interfaces.nsISupportsWeakReference,
	                                       Components.interfaces.nsISupports]),

	PREF_BRANCH_NAME: "extensions.contextsearch.",
	get prefBranch () {
		delete this.prefBranch;
		return this.prefBranch = Services.prefs.getBranch(this.PREF_BRANCH_NAME);
	},

	get ctxMenu () {
		delete this.ctxMenu;
		return this.ctxMenu = document.getElementById("context-searchmenu");
	},
	set ctxMenu (v) {},

	get ctxPopup () {
		delete this.ctxPopup;
		return this.ctxPopup = document.getElementById("context-searchpopup");
	},
	set ctxPopup (v) {},

	get searchEnginesMap () {
		delete this.searchEnginesMap;
		return this.searchEnginesMap = new WeakMap();
	},

	observe: function (aSubject, aTopic, aData) {
		if (aTopic == "browser-search-engine-modified") {
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
		window.removeEventListener("load", this, false);

		window.addEventListener("unload", this, false);
		document.getElementById("contentAreaContextMenu").addEventListener("popupshowing", this, false);
		document.getElementById("context-searchpopup").addEventListener("command", this, false);

		Services.obs.addObserver(this, "browser-search-engine-modified", true);

		this.rebuildmenu();

		// hide default search menu.
		if (this.prefBranch.getBoolPref("hideStandardContextItem")) {
			document.getElementById("context-searchselect").style.display = "none";
		}
	},

	onUnLoad: function () {
		window.removeEventListener("unload", this, false);

		document.getElementById("contentAreaContextMenu").removeEventListener("popupshowing", this, false);
		document.getElementById("context-searchpopup").removeEventListener("command", this, false);

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
		// truncate text for label and set up menu items as appropriate
		if (gContextMenu.isTextSelected) {
			let selectedText = getBrowserSelection(16);
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
		let menuLabel = gNavigatorBundle.getFormattedString("contextMenuSearch", [engineName, aString]);
		return menuLabel.replace(/\s\s/, " ");
	},

	rebuildmenu: function () {
		let popup = this.ctxPopup;
		let engines = Services.search.getVisibleEngines({});

		// clear menu
		while (popup.firstChild) {
			popup.removeChild(popup.firstChild);
		}

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

	get isEnabledTreeStyleTab () {
		delete this.isEnabledTreeStyleTab;
		return this.isEnabledTreeStyleTab = ("TreeStyleTabService" in window) ? true : false;
	},

	search: function (aEvent) {
		let target = aEvent.target;
		let enginesMap = this.searchEnginesMap;
		if (enginesMap.has(target)) {
			let loadInBackground = Services.prefs.
			                       getBoolPref("browser.search.context.loadInBackground");
			let where            = loadInBackground ? "tabshifted" : "tab";
			let selectedText     = getBrowserSelection();
			let searchSubmission = enginesMap.get(target).getSubmission(selectedText, null);
			let searchUrl        = searchSubmission.uri.spec;
			let postData         = searchSubmission.postData;

			if (this.isEnabledTreeStyleTab &&
			    this.prefBranch.getBoolPref("treestyletab.searchResultAsChildren") ) {
				TreeStyleTabService.readyToOpenChildTab();
				openUILinkIn(searchUrl, where, null, postData);
				TreeStyleTabService.stopToOpenChildTab();
			}
			else {
				openUILinkIn(searchUrl, where, null, postData);
			}
		}
	},

};
window.addEventListener("load", ContextSearch, false);
