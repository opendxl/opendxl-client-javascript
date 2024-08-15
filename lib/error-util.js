'use strict'

/**
 * @module ErrorUtil
 * @private
 */

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
    if (Object.prototype.hasOwnProperty.call(Error, 'captureStackTrace')) {
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
  }
}
