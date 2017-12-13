'use strict'

var inherits = require('inherits')
var Message = require('./message')

function Response (request) {
  if (typeof (request) !== 'undefined' && request) {
    Message.call(this, request.replyToTopic)
    this.request = request
    this.requestMessageId = request.messageId
    this.serviceId = request.serviceId
    if (request.sourceClientId) {
      this.clientIds = [request.sourceClientId]
    }
    if (request.sourceBrokerId) {
      this.brokerIds = [request.sourceBrokerId]
    }
  } else {
    Message.call(this, '')
    this.request = null
    this.requestMessageId = null
    this.serviceId = ''
  }

  this.messageType = Message.MESSAGE_TYPE_RESPONSE
}

inherits(Response, Message)

Response.prototype._packMessage = function (buffer) {
  Message.prototype._packMessage.call(this, buffer)
  Message.prototype._packObjects(buffer,
    [this.requestMessageId, this.serviceId])
}

Response.prototype._unpackMessage = function (buffer) {
  Message.prototype._unpackMessage.call(this, buffer)
  this.requestMessageId = Message.prototype._unpackObject(buffer)
  this.serviceId = Message.prototype._unpackObject(buffer)
}

module.exports = Response
