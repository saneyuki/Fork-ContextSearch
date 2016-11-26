/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/*eslint-env commonjs */

const EXPORTED_SYMBOLS = ["WebExtRTMessageChannel"]; // eslint-disable-line no-unused-vars

class WebExtRTMessageChannel {
  /**
   *  @param  { { runtime: ? } } browser
   *  @returns {WebExtRTMessageChannel}
   */
  static create(browser) {
    const inst = new WebExtRTMessageChannel(browser);
    return inst;
  }

  constructor(browser) {
    this._runtime = browser.runtime;
    this._port = null;
    this._callback = new Map();
    this._callbackId = 0;

    this._portOnMessage = null;
    this._connected = null;

    Object.seal(this);
    this._init();
  }

  destroy() {
    this._finalize();

    this._connected = null;
    this._portOnMessage = null;

    this._callback = null;
    this._runtime = null;
    this._port = null;
  }

  _init() {
    this._portOnMessage = (msg) => {
      this._onPortMessage(msg);
    };

    this._connected = new Promise((resolve) => {
      const that = this;
      this._runtime.onConnect.addListener(function onConnect(port) {
        that._runtime.onConnect.removeListener(onConnect); // eslint-disable-line no-underscore-dangle

        that._port = port; // eslint-disable-line no-underscore-dangle
        port.onMessage.addListener(that._portOnMessage); // eslint-disable-line no-underscore-dangle
        resolve();
      });
    });
  }

  _finalize() {
    // If touch these propertes on uninstall phase, it causes the error touching a dead object.
    // So this line is commented out.
    //this._port.onMessage.removeListener(this._portOnMessage);

    this._callback.clear();
  }

  /**
   *  @returns  {Promise<void>}
   */
  connect() {
    return this._connected;
  }

  /**
   *  @template T, R
   *  @param  {string}  type
   *  @param  {T} value
   *  @returns  {Promise<R>}
   */
  postMessage(type, value) {
    if (this._port === null) {
      throw new TypeError("`port` must not be `null`.");
    }

    const task = new Promise((resolve, reject) => {
      const id = this._callbackId;
      this._callbackId = id + 1;
      const message = {
        type,
        id,
        value,
      };
      this._callback.set(id, [resolve, reject]);
      this._port.postMessage(message);
    });
    return task;
  }

  /**
   *  @template T
   *  @param  { { id: number, type: string, value: T, } }  msg
   *  @returns  {void}
   */
  _onPortMessage(msg) {
    const { id, value, } = msg;
    if (!this._callback.has(id)) {
      throw new TypeError("no promise resolver");
    }

    const [resolver, ] = this._callback.get(id);
    this._callback.delete(id);
    resolver(value);

    if (this._callback.size === 0) {
      this._callbackId = 0;
    }
  }
}
this.WebExtRTMessageChannel = WebExtRTMessageChannel; // eslint-disable-line no-invalid-this

