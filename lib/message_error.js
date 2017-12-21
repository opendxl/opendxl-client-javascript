'use strict'

var inherits = require('inherits')
var Message = require('./message')
var util = require('./util')

function MessageError (message) {
  if (!message || !(message instanceof Message)) {
    throw new TypeError('Error did not include a Dxl message')
  }

  var errorMessage = message.message
  if (message !== 'undefined' && message.errorMessage !== 'undefined') {
    errorMessage = message.errorMessage
  }
  util._initializeError(this, errorMessage)

  this.detail = message
}

inherits(MessageError, Error)

Object.defineProperty(MessageError.prototype, 'code', {
  get: function () {
    var code = 0
    if (this.detail !== 'undefined' && this.detail.errorCode !== 'undefined') {
      code = this.detail.errorCode
    }
    return code
  }
})

module.exports = MessageError
