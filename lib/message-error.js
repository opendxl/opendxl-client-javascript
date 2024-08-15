'use strict'

const inherits = require('inherits')
const Message = require('./message')
const errorUtil = require('./error-util')

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

  let errorMessage = message.payload
  if (Object.prototype.hasOwnProperty.call(message, 'errorMessage')) {
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
    let code = 0
    if (Object.prototype.hasOwnProperty.call(this, 'detail') && Object.prototype.hasOwnProperty.call(this.detail, 'errorCode')) {
      code = this.detail.errorCode
    }
    return code
  }
})

module.exports = MessageError
