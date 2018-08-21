'use strict'

var inherits = require('inherits')
var MessageErrorCode = require('./message-error-code')
var util = require('./util')

var errorCodesToNames = {
  0x80000001: MessageErrorCode.SERVICE_UNAVAILABLE,
  0x80000002: MessageErrorCode.SERVICE_OVERLOADED,
  0x80000003: MessageErrorCode.RESPONSE_TIMEOUT
}

/**
 * @classdesc An exception which wraps an error-type DXL {@link Message} - for
 *   example, {@link ErrorResponse}. This is used for communicating a DXL
 *   error as an object which derives from {@link Error}.
 * @param {Message} message - The DXL {@link Message} which this exception
 *   wraps.
 * @augments Error
 * @constructor
 */
function MessageError (message) {
  if (!message) {
    throw new TypeError('Error did not include a message')
  }

  var errorMessage = message.errorMessage || message.payload

  /**
   * Error code associated with the DXL {@link Message}. This is the same
   * value which appears in the {@link ErrorResponse#errorCode} for
   * an {@link ErrorResponse}.
   * @type {Number}
   */
  this.dxlErrorCode = 0

  // Map a string for the error code if if the error is well-known.
  var errorCodeString
  if (message.hasOwnProperty('errorCode')) {
    this.dxlErrorCode = message.errorCode
    var normalizedErrorCode = this.dxlErrorCode
    if (this.dxlErrorCode < 0) {
      normalizedErrorCode = 0xFFFFFFFF + this.dxlErrorCode + 1
    }
    errorCodeString = errorCodesToNames[normalizedErrorCode]
  }

  /**
   * String label that identifies the kind of error. See
   * [MessageErrorCode]{@link module:MessageErrorCode}
   * for a list of possible string constants.
   * @name MessageError#code
   * @type {String}
   */

  util.initializeError(this, errorMessage, errorCodeString)

  /**
   * The DXL {@link Message} with more detail for the error.
   * @type {Message}
   */
  this.dxlMessage = message

  /**
   * The DXL {@link Message} with more detail for the error.
   * @type {Message}
   * @deprecated in favor of {@link MessageError#dxlMessage}
   */
  this.detail = this.dxlMessage
}

inherits(MessageError, Error)

module.exports = MessageError
