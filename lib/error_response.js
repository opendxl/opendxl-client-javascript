'use strict'

var inherits = require('inherits')
var Message = require('./message')
var Response = require('./response')

function ErrorResponse (request, errorCode, errorMessage) {
  if (typeof (errorCode) === 'undefined') { errorCode = 0 }
  if (typeof (errorMessage) === 'undefined') { errorMessage = '' }

  Response.call(this, request)
  this.errorCode = errorCode
  this.errorMessage = errorMessage

  this.messageType = Message.MESSAGE_TYPE_ERROR
}

inherits(ErrorResponse, Response)

ErrorResponse.prototype._packMessage = function (buffer) {
  Response.prototype._packMessage.call(this, buffer)
  Message.prototype._packObjects(buffer,
    [this.errorCode, this.errorMessage])
}

ErrorResponse.prototype._unpackMessage = function (buffer) {
  Response.prototype._unpackMessage.call(this, buffer)
  this.errorCode = Message.prototype._unpackObject(buffer)
  this.errorMessage = Message.prototype._unpackObject(buffer)
}

module.exports = ErrorResponse
