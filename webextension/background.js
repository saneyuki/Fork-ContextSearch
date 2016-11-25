/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/*global browser: false */
/* eslint-disable no-implicit-globals */

const port = browser.runtime.connect({});
port.onMessage.addListener((msg) => {
  const { type, id, value } = msg;
  switch (type) {
    case "contextsearch-open-tab": {
      const { url, where } = value;
      const response = {
        id,
        type: "context-search-open-tab-result",
        value: null,
      };
      const creating = createTab(url, where);
      creating.then((tabId) => {
        response.value = {
          ok: true,
          tabId: tabId,
          error: null,
        };
        port.postMessage(response);
      }, (e) => {
        response.value = {
          ok: false,
          tabId: null,
          error: e.message,
        };
        port.postMessage(response);
      });
      break;
    }
  }
});

/**
 *  @param  {string}  url
 *  @param  {string}  where
 *  @returns  {number}
 *    `tabs.Tab.id`. integer.
 */
async function createTab(url, where) {
  const option = {
    active: false,
    url,
    windowId: null,
  };

  switch (where) {
    case "tab":
      option.active = true;
      break;
    case "tabshifted":
      break;
    default:
      throw new RangeError("unexpeced where type");
  }

  const newTab = await browser.tabs.create(option);
  return newTab.id;
}

