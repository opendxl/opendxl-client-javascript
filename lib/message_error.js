'use strict'

var inherits = require('inherits')
var Message = require('./message')
var util = require('./util')

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
  util._initializeError(this, errorMessage)

  this.detail = message
}

inherits(MessageError, Error)

/**
 * @property {Number} - Error code associated with the DXL {@link Message}.
 *   Returns _0_ if no code could be derived from the message.
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
