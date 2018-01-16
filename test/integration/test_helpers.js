'use strict'

/** @module TestHelpers */

var Buffer = require('safe-buffer').Buffer

module.exports = {
  /**
   * Parse the payload from the supplied {@link Message} into a String.
   * @param {Message} message - The message to parse.
   * @param {String} [encoding=utf8] - The character encoding to decode the
   *   message from if the payload is a {@link Buffer}.
   */
  decodePayload: function (message, encoding) {
    encoding = (typeof encoding === 'undefined') ? 'utf8' : encoding
    var payload = message.payload
    if (Buffer.isBuffer(payload)) {
      payload = payload.toString(encoding)
    }
    return payload
  },
  /**
   * Parse the payload from the supplied {@link Message} into a JSON object.
   * @param {Message} message - The message to parse.
   * @returns {Object} The object parsed from the payload.
   */
  jsonPayloadToObject: function (message) {
    // The DXL broker may add a trailing null byte to the end of a JSON
    // payload. Strip one off if found before parsing.
    return JSON.parse(module.exports.decodePayload(message).replace(/\0$/, ''))
  }
}
