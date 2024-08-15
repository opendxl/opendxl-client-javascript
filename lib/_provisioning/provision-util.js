'use strict'

/**
 * @module ProvisionUtil
 * @private
 */

const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const DxlError = require('../dxl-error')

/**
 * Default file mode to use for storing new files. Read-only for all but the
 * owner.
 * @type {Number}
 */
const _0644 = parseInt('0644', 8)

/**
 * Default file mode to use for creation of a directory. Read only (but
 * executable) for all but the owner.
 * @type {Number}
 */
const _0755 = parseInt('0755', 8)

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
   * Writes an error to the log.
   * @param {(String|Error)} error - The Error or error message string to log.
   * @param {Object} [options] - Error message options.
   * @param {String} [options.component] - Description of the system component
   *   in which the error occurred.
   * @param {String} [options.header] - Prefix to include before the error
   *   message.
   * @param {Number} [options.verbosity] - Level of verbosity at which to log
   *   the error message.
   */
  logError: function (error, options) {
    options = options || {}
    const verbosity = options.verbosity || 0
    let message = module.exports.getErrorMessage(
      typeof error === 'object' ? error.message : error, options.component,
      options.header)
    if (typeof header === 'undefined') {
      message = 'ERROR: ' + message
    }
    console.error(message)
    if ((verbosity > 1) && (typeof error === 'object') && error.stack) {
      console.log(error.stack)
    }
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
    fs.writeFileSync(file, data, { mode: _0644 })
  },
  /**
   * Invokes a callback with the supplied `Error`.
   * @param {Error} error - The error.
   * @param {Function} callback - Callback to invoke. If null, the `Error`
   *   is written to a log.
   * @param {Number} [verbosity] - Level of verbosity at which to log the
   *   error message if the callback is not invoked.
   */
  invokeCallback: function (error, callback, verbosity) {
    if (callback) {
      callback(error)
    } else {
      module.exports.logError(error, { verbosity })
    }
  }
}
