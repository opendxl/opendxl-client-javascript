'use strict'
var inherits = require('inherits')
var Message = require('./message')

function Request (destinationTopic) {
  Message.call(this, destinationTopic)
  this.messageType = Message.MESSAGE_TYPE_REQUEST
  this.replyToTopic = ''
  this.serviceId = ''
}

inherits(Request, Message)

Request.prototype._packMessage = function (buffer) {
  Message.prototype._packMessage.call(this, buffer)
  Message.prototype._packObjects(buffer, [this.replyToTopic, this.serviceId])
}

Request.prototype._unpackMessage = function (buffer) {
  Message.prototype._unpackMessage.call(this, buffer)
  this.replyToTopic = Message.prototype._unpackObject(buffer)
  this.serviceId = Message.prototype._unpackObject(buffer)
}

module.exports = Request
