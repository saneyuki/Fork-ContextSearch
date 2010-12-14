/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Context Search.
 *
 * The Initial Developer of the Original Code is
 *   Ben Basson <ben@basson.at>
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Ben Basson <ben@basson.at>
 *   saneyuki_s
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var contextsearch = {

	handleEvent: function (aEvent) {
		switch (aEvent.type) {
			case "load":
				this.onLoad();
				break;
			case "popupshowing":
				this.popuphandler();
				break;
			case "unload":
				this.onUnLoad();
				break;
		}
	},

	get searchService () {
		delete this.searchService;
		return this.searchService = Components.classes["@mozilla.org/browser/search-service;1"]
		                            .getService(Components.interfaces.nsIBrowserSearchService);
	},

	get prefService () {
		delete this.prefService;
		return this.prefService = Components.classes["@mozilla.org/preferences-service;1"]
		                          .getService(Components.interfaces.nsIPrefService);
	},

	PREF_BRANCH_NAME: "extensions.contextsearch.",
	get prefBranch () {
		delete this.prefBranch;
		return this.prefBranch = this.prefService.getBranch(this.PREF_BRANCH_NAME)
		                         .QueryInterface(Components.interfaces.nsIPrefBranch2);
	},

	get ctxMenu () {
		delete this.ctxMenu;
		return this.ctxMenu = document.getElementById("context-searchmenu");
	},

	get ctxPopup () {
		delete this.ctxPopup;
		return this.ctxPopup = document.getElementById("context-searchpopup");
	},

	get ctxItemSearchSelect () {
		delete this.ctxItemSearchSelect;
		return this.ctxItemSearchSelect = document.getElementById("context-searchselect");
	},

	get hideMenuItem () {
		delete this.hideMenuItem;
		return this.hideMenuItem = this.prefBranch.getBoolPref("hideStandardContextItem");
	},

	onLoad: function () {
		window.removeEventListener("load", this, false);
		document.getElementById("contentAreaContextMenu").addEventListener("popupshowing", this, false);
		window.addEventListener("unload", this, false);
	},

	onUnLoad: function () {
		window.removeEventListener("unload", this, false);
		document.getElementById("contentAreaContextMenu").removeEventListener("popupshowing", this, false);
	},

	popuphandler: function() {
		var selectedText = this.getBrowserSelection(16);

		// truncate text for label and set up menu items as appropriate
		if (selectedText != null && selectedText.length > 0) {
			if (selectedText.length > 15) {
				selectedText = selectedText.substr(0,15) + "...";
			}

			var menuLabel = this.getMenuItemLabel(selectedText, false);

			this.rebuildmenu();
			this.setupDefaultMenuItem(selectedText);
			this.ctxMenu.setAttribute("label", menuLabel);
			this.ctxMenu.setAttribute("hidden","false");
		}

		else {
			this.ctxMenu.setAttribute("hidden","true");
		}
	},

	getBrowserSelection: function (aCharCount, aEvent) {
		var focusedElement = document.commandDispatcher.focusedElement;
		var selectedText = null;

		// get text selection from input node
		if (this.isTextInputNode(focusedElement) 
		    && this.textSelectedInNode(focusedElement)) {
			var startPos = focusedElement.selectionStart;
			var endPos = focusedElement.selectionEnd;

			if (aCharCount && (aCharCount < (endPos - startPos))) {
				endPos = startPos + ((aCharCount <= 150) ? aCharCount : 150);
			}

			selectedText = focusedElement.value.substring(startPos, endPos);
		}
		// if an event is passed from the menu, we can assume there's a selection
		// otherwise check text is selected
		else if (aEvent || (gContextMenu && gContextMenu.isTextSelected)) {
			selectedText = getBrowserSelection(aCharCount);
		}

		return selectedText;
	},

	isTextInputNode: function (aNode) {
		try {
			return ((aNode instanceof HTMLInputElement) || (aNode instanceof HTMLTextAreaElement));
		} catch (e) {
			return false;
		}
	},

	textSelectedInNode: function (aNode) {
		try {
			return (aNode.selectionStart < aNode.selectionEnd);
		} catch (e) {
			return false;
		}
	},

	// shamelessly ripped from browser.js
	getMenuItemLabel: function (aString, aUseEngineName) {
		var engineName = "";

		if (aUseEngineName) {
			var ss = this.searchService;

			// Firefox 3.0
			if (window.isElementVisible && isElementVisible(BrowserSearch.searchBar)) {
				engineName =  ss.currentEngine.name; 
			}

			// Fallback in any other case, or if functions yield false/null
			else {
				engineName = ss.defaultEngine.name;
			}
		}

		// format "Search <engine> for <selection>" string to show in menu
		var menuLabel = gNavigatorBundle.getFormattedString("contextMenuSearchText", [engineName, aString]);
		return aUseEngineName ? menuLabel : menuLabel.replace(/\s\s/," ");
	},

	setupDefaultMenuItem: function (selectedText) {
		var menuItem = this.ctxItemSearchSelect;

		// only go to this effort if pref is flipped
		if (this.hideMenuItem == false) {
			var menuLabel = this.getMenuItemLabel(selectedText, true);

			// set label, show item and return
			menuItem.setAttribute("label", menuLabel);
			menuItem.setAttribute("hidden","false");
		}

		else {
			menuItem.setAttribute("hidden","true");
		}

		return true;
	},

	rebuildmenu: function () {
		const kXULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

		var popup = this.ctxPopup;
		var engines = this.searchService.getVisibleEngines({ });

		// clear menu
		while (popup.firstChild) {
			popup.removeChild(popup.firstChild);
		}

		for (var i = engines.length - 1; i >= 0; --i) {
			var menuitem = document.createElementNS(kXULNS, "menuitem");
			menuitem.setAttribute("label", engines[i].name);
			menuitem.setAttribute("id", engines[i].name);
			menuitem.setAttribute("class", "menuitem-iconic contextsearch-menuitem");

			if (engines[i].iconURI) {
				menuitem.setAttribute("image", engines[i].iconURI.spec);
			}

			popup.insertBefore(menuitem, popup.firstChild);
			menuitem.engine = engines[i];
			menuitem.setAttribute("onclick", "return contextsearch.menuitemclick(event);");
		}
	},

	menuitemclick: function (aEvent) {
		// only process middle clicks
		if (aEvent.button != 1) {
			return false;
		}

		// hide context menu
		var node = aEvent.target.parentNode;
		while (node.parentNode) {
			if (node.hidePopup) {
				node.hidePopup();
			}
			node = node.parentNode;
		}

		// continue with search
		this.search(aEvent);
		return true;
	},

	get isEnabledTreeStyleTab () {
		delete this.isEnabledTreeStyleTab;

		var isEnabled;
		if ("TreeStyleTabService" in window) {
			isEnabled = true;
		}
		else {
			isEnabled = false;
		}
		return this.isEnabledTreeStyleTab = isEnabled;
	},

	search: function (aEvent) {
		if (!aEvent.target.id) {
			return;
		}

		var where = this._whereToOpenLink(aEvent);
		var selectedText = this.getBrowserSelection(null, aEvent);
		var searchSubmission = aEvent.target.engine.getSubmission(selectedText, null);
		var searchUrl = searchSubmission.uri.spec;
		var postData = searchSubmission.postData;

		if (this.isEnabledTreeStyleTab &&
		    this.prefBranch.getBoolPref("treestyletab.searchResultAsChildren")
		) {
			TreeStyleTabService.readyToOpenChildTab();
			openUILinkIn(searchUrl, where, null, postData);
			TreeStyleTabService.stopToOpenChildTab();
		}
		else {
			openUILinkIn(searchUrl, where, null, postData);
		}
	},

	_whereToOpenLink: function (aEvent) {
		var where = whereToOpenLink(aEvent, false, true);
		var loadInBackground = this.prefService.getBoolPref("browser.tabs.loadInBackground");
		switch (where) {
			case "current":
				return loadInBackground ? "tabshifted" : "tab";
			default: 
				return where;
		}
	},
};
window.addEventListener("load", contextsearch, false);
