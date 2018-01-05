'use strict'

/** @module Util */

var uuidv4 = require('uuid/v4')

module.exports = {
  /**
   * Initialize the supplied object with the standard information which appears
   * on an {@link Error} function. This function is used to allow a function
   * to derive from the {@link Error} function.
   * @param {Object} obj - The object to initialize error data onto.
   * @param {String} [message=null] - An error message.
   * @private
   */
  _initializeError: function (obj, message) {
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
   * @private
   * @param {(Number|String)} text - The text to convert to a port number.
   * @returns {Number} The port number.
   * @throws {TypeError} If the _text_ parameter cannot be converted to a
   *   numeric value.
   * @throws {RangeError} If the _text_ parameter is not in the well-known IANA
   *   TCP port range (1 - 65535).
   */
  _toPortNumber: function (text) {
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
