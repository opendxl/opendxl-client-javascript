'use strict'
var inherits = require('inherits')

function DxlError (message) {
  Error.call(this, message)
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, this.constructor)
  }
  this.name = this.constructor.name
  this.message = message
}

inherits(DxlError, Error)

module.exports.DxlError = DxlError
