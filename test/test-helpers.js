'use strict'

/** @module TestHelpers */

var Buffer = require('safe-buffer').Buffer

module.exports = {
  /**
   * Parses the payload from the supplied {@link Message} into a String.
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
   * Parses the payload from the supplied {@link Message} into a JSON object.
   * @param {Message} message - The message to parse.
   * @returns {Object} The object parsed from the payload.
   */
  jsonPayloadToObject: function (message) {
    // The DXL broker may add a trailing null byte to the end of a JSON
    // payload. Strip one off if found before parsing.
    return JSON.parse(module.exports.decodePayload(message).replace(/\0$/, ''))
  },
  /**
   * Invokes the {@link Client#asyncRequest} method for the supplied client
   * and request. If an error occurs, the {@link ErrorResponse} is passed in
   * a call to the errorCallback. If no error occurs, the {@link Response} is
   * passed in a call to the responseCallback.
   * @param {Client} client - The {@link Client} on which to invoke the request.
   * @param {Request} request - The {@link Request} to send to the client.
   * @param {Function} errorCallback - The function to invoke with the
   *   {@link ErrorResponse} if an error occurs.
   * @param {Function} responseCallback - The function to invoke with the
   *   {@link Response} if the request is successful.
   */
  asyncRequest: function (client, request, errorCallback, responseCallback) {
    client.asyncRequest(request, function (error, response) {
      if (error) {
        errorCallback(error)
      } else {
        responseCallback(response)
      }
    })
  },
  DXL_SERVICE_UNAVAILABLE_ERROR_CODE: 0x80000001,
  DXL_SERVICE_UNAVAILABLE_ERROR_MESSAGE: 'unable to locate service for request',
  /**
   * Returns a normalized representation of the error code in a
   * {@link MessageError}. A negative error code value would be converted to a
   * 32-bit unsigned number.
   * @param {MessageError} error - The error containing the code.
   * @returns {Number} The error code (normalized as an unsigned 32-bit number).
   */
  normalizedErrorCode: function (error) {
    var errorCode = 0
    if ('code' in error) {
      errorCode = error.code < 0 ? 0xFFFFFFFF + error.code + 1 : error.code
    }
    return errorCode
  }
}
