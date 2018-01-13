'use strict'

var Buffer = require('safe-buffer').Buffer

module.exports = {
  /**
   * Parse the payload from the supplied {@link Message} into a JSON object.
   * @param {Message} message - The message to parse.
   * @returns {Object} The object parsed from the payload.
   */
  messagePayloadAsJson: function (message) {
    var payload = message.payload
    if (Buffer.isBuffer(payload)) {
      payload = payload.toString('utf8')
    }
    // The DXL broker may add a trailing null byte to the end of a JSON
    // payload. Strip one off if found before parsing.
    return JSON.parse(payload.replace(/\0$/, ''))
  }
}
