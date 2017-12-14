'use strict'

var inherits = require('inherits')

function initializeError (message) {
  // jshint validthis: true
  Error.call(this, message)
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, this.constructor)
  }
  this.name = this.constructor.name
  this.message = message
}

module.exports = {
  DxlError: function DxlError (message) {
    initializeError.call(this, message)
  },
  MalformedBrokerError: function MalformedBrokerError (message) {
    initializeError.call(this, message)
  }
}

inherits(module.exports.DxlError, Error)
inherits(module.exports.MalformedBrokerError, module.exports.DxlError)
