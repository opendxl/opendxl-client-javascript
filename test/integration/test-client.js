'use strict'

var fs = require('fs')
var inherits = require('inherits')
var os = require('os')
var path = require('path')
var dxl = require('../..')
var Client = dxl.Client
var Config = dxl.Config
var DxlError = dxl.DxlError

var DEFAULT_TIMEOUT = 5000
var CLIENT_CONFIG_FILE = 'client_config.cfg'

/**
 * @classdesc Creates a test {@link Client} for integration testing.
 * @param {Object} test - Test instance which will use the client
 * @param {Function} [errorCallback=null] - Optional callback to invoke if an
 *   error occurs.
 * @param {Number} [timeout=5000] - Delay (in milliseconds) before the
 *   error callback is invoked. If {@link TestClient#destroy} is called
 *   before the timeout is reached, the callback will not be invoked.
 * @constructor
 */
function TestClient (test, errorCallback, timeout) {
  var that = this

  var configDirs = [ __dirname, os.homedir() ]
  var configFile = null

  configDirs.forEach(function (configDir) {
    var candidateConfigFile = path.join(configDir, CLIENT_CONFIG_FILE)
    if (fs.existsSync(candidateConfigFile)) {
      configFile = candidateConfigFile
    }
  })

  if (!configFile) {
    throw new DxlError(
      'Unable to locate client config file at ' +
      path.join(configDirs[0], CLIENT_CONFIG_FILE))
  }

  Client.call(this, Config.createDxlConfigFromFile(configFile))

  this._errorCallback = errorCallback
  if (typeof errorCallback === 'undefined') {
    this._errorCallback = null
  }

  this._timeoutHandle = null
  if (this._errorCallback) {
    if (typeof timeout === 'undefined') { timeout = DEFAULT_TIMEOUT }
    test.timeout(timeout + (timeout / 10))
    this._timeoutHandle = setTimeout(function () {
      that._timeoutHandle = null
      that.destroy(function () {
        that._errorCallback(new Error('Timeout of ' + timeout + ' ms exceeded'))
      })
    }, timeout)
  }

  this._destroyed = false

  /**
   * Shuts down the test client and its underlying resources (including its
   * logic to monitor client timeouts).
   * @param {Error} error - Error to deliver to the error callback. If this
   *   function is called before the timeout specified during construction of
   *   the test client is reached, the error callback will not be invoked.
   * @param {Function} [callback=null] - Optional callback to invoke after
   *   the client has been destroyed. If the error parameter is non-null, the
   *   error callback specified at test client construction time will be
   *   invoked instead of the callback specified in this parameter.
   */
  this.shutdown = function (error, callback) {
    if (this._timeoutHandle) {
      clearTimeout(this._timeoutHandle)
      this._timeoutHandle = null
    }
    if (!that._destroyed) {
      this.destroy(function () {
        if (error) {
          if (that._errorCallback) {
            that._errorCallback(error)
          }
        } else if (typeof callback !== 'undefined') {
          callback()
        }
      })
      that._destroyed = true
    }
  }
}

inherits(TestClient, Client)

module.exports = TestClient
