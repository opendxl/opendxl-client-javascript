'use strict'

/**
 * @module Util
 * @private
 */

var fs = require('fs')
var ini = require('ini')
var path = require('path')
var uuidv4 = require('uuid/v4')
var DxlError = require('./dxl-error')

module.exports = {
  /**
   * Initialize the supplied object with the standard information which appears
   * on an {@link Error} function. This function is used to allow a function
   * to derive from the {@link Error} function.
   * @param {Object} obj - The object to initialize error data onto.
   * @param {String} [message=null] - An error message.
   */
  initializeError: function (obj, message) {
    Error.call(obj, message)
    if (Error.hasOwnProperty('captureStackTrace')) {
      Error.captureStackTrace(obj, obj.constructor)
    }
    obj.name = obj.constructor.name
    obj.message = message
  },
  /**
   * Generates and returns a random UUID that is all lowercase and has
   * enclosing brackets.
   * @returns {string}
   */
  generateIdAsString: function () {
    return '{' + uuidv4().toLowerCase() + '}'
  },
  /**
   * Attempts to convert the supplied text parameter to a numeric value
   * which represents a port number.
   * @param {(Number|String)} text - The text to convert to a port number.
   * @returns {Number} The port number.
   * @throws {TypeError} If the _text_ parameter cannot be converted to a
   *   numeric value.
   * @throws {RangeError} If the _text_ parameter is not in the well-known IANA
   *   TCP port range (1 - 65535).
   */
  toPortNumber: function (text) {
    var number = parseInt(text)
    if (isNaN(number)) {
      throw new TypeError("Port '" + text +
        "' cannot be converted into a number")
    }
    if (number < 1 || number > 65535) {
      throw new RangeError('Port number ' + text +
        ' not in valid range (1-65535)')
    }
    return number
  },
  getConfigFileData: function (configFile) {
    var configData
    try {
      configData = fs.readFileSync(configFile, 'utf-8')
    } catch (err) {
      throw new DxlError('Unable to read config file: ' + err.message)
    }
    var lineSeparator = '\r\n'
    if (configData.indexOf(lineSeparator) < 0) {
      lineSeparator = '\r'
      if (configData.indexOf(lineSeparator) < 0) {
        lineSeparator = '\n'
      }
    }
    return {
      lineSeparator: lineSeparator,
      lines: configData.split(new RegExp(lineSeparator))
    }
  },
  getConfigFileAsObject: function (configFile) {
    var lines = module.exports.getConfigFileData(configFile)['lines']
    // The ini parser treats ';' and '#' characters in the middle of a line
    // as the beginning of a comment and trims the rest off when parsing.
    // For any lines that don't start with either of these characters, though,
    // we do not want to interpret these as comments - especially for the
    // value of a broker config entry, which is internally delimited with
    // ';' characters. The logic below ensures that these characters are
    // escaped so that the ini parser preserves them.
    var escapedLines = lines.map(function (line) {
      if (line && !line.match(/^\s*[;#]/)) {
        line = line.replace(/;/g, '\\;').replace(/#/g, '\\#')
      }
      return line
    })
    var escapedConfigData = escapedLines.join('\n')

    var parsedConfig
    try {
      parsedConfig = ini.parse(escapedConfigData)
    } catch (err) {
      throw new DxlError('Unable to parse config file: ' + err.message)
    }
    return parsedConfig
  },
  getConfigFilePath: function (configPath, fileName) {
    var configFile = fileName
    // If the file cannot be found but is expressed as a relative path, try to
    // find the file relative to directory in which the configuration file
    // resides.
    if (!fs.existsSync(fileName) && !path.isAbsolute(fileName) &&
      (typeof (configPath) !== 'undefined') && configPath) {
      configFile = path.join(configPath, fileName)
    }
    return configFile
  }
}
