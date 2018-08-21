'use strict'

/**
 * @module Util
 * @private
 */

var uuidv4 = require('uuid/v4')

module.exports = {
  /**
   * Initialize the supplied object with the standard information which appears
   * on an {@link Error} function. This function is used to allow a function
   * to derive from the {@link Error} function.
   * @param {Object} obj - The object to initialize error data onto.
   * @param {String} [message] - An error message.
   * @param {String} [code] - An error code.
   */
  initializeError: function (obj, message, code) {
    Error.call(obj, message)
    if (Error.hasOwnProperty('captureStackTrace')) {
      Error.captureStackTrace(obj, obj.constructor)
    }
    obj.name = obj.constructor.name
    if (code) {
      obj.code = code
      obj.name += ' [' + code + ']'
    } else {
      obj.code = ''
    }
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
  }
}
