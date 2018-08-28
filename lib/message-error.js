'use strict'

var inherits = require('inherits')
var Message = require('./message')
var errorUtil = require('./error-util')

/**
 * @classdesc An exception which wraps an error-type DXL {@link Message} - for
 *   example, {@link ErrorResponse}. This is used for communicating a DXL
 *   error as an object which derives from {@link Error}.
 * @param {Message} message - The DXL {@link Message} which this exception
 *   wraps.
 * @constructor
 */
function MessageError (message) {
  if (!message || !(message instanceof Message)) {
    throw new TypeError('Error did not include a Dxl message')
  }

  var errorMessage = message.payload
  if (message.hasOwnProperty('errorMessage')) {
    errorMessage = message.errorMessage
  }
  errorUtil.initializeError(this, errorMessage)

  /**
   * The DXL {@link Message} with more detail for the error.
   * @type {Message}
   * @name MessageError#detail
   */
  this.detail = message
}

inherits(MessageError, Error)

/**
 * @property {Number} - Error code associated with the DXL {@link Message}.
 * @default 0
 * @name MessageError#code
 */
Object.defineProperty(MessageError.prototype, 'code', {
  get: function () {
    var code = 0
    if (this.hasOwnProperty('detail') &&
      this.detail.hasOwnProperty('errorCode')) {
      code = this.detail.errorCode
    }
    return code
  }
})

module.exports = MessageError
