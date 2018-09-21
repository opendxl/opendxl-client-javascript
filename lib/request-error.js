'use strict'

var inherits = require('inherits')
var ResponseErrorCode = require('./response-error-code')
var errorUtil = require('./error-util')

var errorCodesToNames = {
  0x80000001: ResponseErrorCode.SERVICE_UNAVAILABLE,
  0x80000002: ResponseErrorCode.SERVICE_OVERLOADED,
  0x80000003: ResponseErrorCode.RESPONSE_TIMEOUT
}

/**
 * @classdesc An exception which can be passed in a response callback to
 *   a failed {@link Client#asyncRequest} call.
 * @param {ErrorResponse} errorResponse - The DXL {@link ErrorResponse}
 *   returned from the DXL fabric for the failed request.
 * @augments Error
 * @constructor
 */
function RequestError (errorResponse) {
  if (!errorResponse) {
    throw new TypeError('Error did not include an errorResponse')
  }

  var errorMessage = errorResponse.errorMessage || errorResponse.payload

  // Map a string for the error code if if the error is well-known.
  var errorCodeString
  if (errorResponse.hasOwnProperty('errorCode')) {
    var normalizedErrorCode = errorResponse.errorCode
    if (normalizedErrorCode < 0) {
      normalizedErrorCode = 0xFFFFFFFF + normalizedErrorCode + 1
    }
    errorCodeString = errorCodesToNames[normalizedErrorCode]
  }

  /**
   * String label that identifies the kind of error. See
   * [ResponseErrorCode]{@link module:ResponseErrorCode}
   * for a list of possible string constants.
   * @name RequestError#code
   * @type {String}
   */

  errorUtil.initializeError(this, errorMessage, errorCodeString)

  /**
   * The DXL {@link ErrorResponse} with more detail for the error.
   * @type {ErrorResponse}
   */
  this.dxlErrorResponse = errorResponse

  /**
   * The DXL {@link ErrorResponse} with more detail for the error.
   * @type {ErrorResponse}
   * @deprecated in favor of {@link RequestError#dxlErrorResponse}
   */
  this.detail = this.dxlErrorResponse
}

inherits(RequestError, Error)

module.exports = RequestError
