'use strict'

/**
 * @module ProvisionUtil
 * @private
 */

var fs = require('fs')
var path = require('path')
var mkdirp = require('mkdirp')
var DxlError = require('../dxl-error')

/**
 * Default file mode to use for storing new files. Read-only for all but the
 * owner.
 * @type {Number}
 */
var _0644 = parseInt('0644', 8)

/**
 * Default file mode to use for creation of a directory. Read only (but
 * executable) for all but the owner.
 * @type {Number}
 */
var _0755 = parseInt('0755', 8)

module.exports = {
  /**
   * Default name of the DXL client configuration file to store.
   * @type {String}
   */
  DEFAULT_CONFIG_FILE_NAME: 'dxlclient.config',
  /**
   * Returns a formatted error message string for use in log and exception
   * messages.
   * @param {String} message - The base message.
   * @param {String} [component] - Description of the system component in which
   *   the error occurred.
   * @param {String} [header] - Prefix to include before the error message.
   * @returns {String} The formatted error message.
   */
  getErrorMessage: function (message, component, header) {
    if (typeof header === 'undefined') {
      header = ''
    }
    if (component) {
      if (header) {
        header += ' '
      }
      header += '('
      header += component
      header += ')'
    }
    if (header) {
      message = header + ': ' + message
    }
    return message
  },
  /**
   * Logs an error message to the console.
   * @param {String} message - The base message.
   * @param {String} component - Description of the system component in which
   *   the error occurred.
   * @param {String} header - Prefix to include before the error message.
   */
  logError: function (message, component, header) {
    message = module.exports.getErrorMessage(message, component, header)
    if (typeof header === 'undefined') {
      message = 'ERROR: ' + message
    }
    console.error(message)
  },
  /**
   * Creates a {@link DxlError} with an error message which is formatted
   * for use in logging.
   * @param {String} message - The base message.
   * @param {String} [component] - Description of the system component in which
   *   the error occurred.
   * @param {String} [header] - Prefix to include before the error message.
   * @returns {DxlError} The formatted error message.
   */
  createFormattedDxlError: function (message, component, header) {
    return new DxlError(module.exports.getErrorMessage(
      message, component, header))
  },
  /**
   * Creates a nested directory structure, if the supplied directory does not
   * already exist.
   * @param {String} dir - Directory to create.
   */
  mkdirRecursive: function (dir) {
    if (!fs.existsSync(dir)) {
      mkdirp.sync(dir, _0755)
    }
  },
  /**
   * Saves the supplied data into the specified file. This function attempts to
   * create the directory in which the file would reside if the directory does
   * not already exist.
   * @param {String} file - File to create.
   * @param {String} data - Data to store in the file.
   */
  saveToFile: function (file, data) {
    module.exports.mkdirRecursive(path.dirname(file))
    fs.writeFileSync(file, data, {mode: _0644})
  }
}
