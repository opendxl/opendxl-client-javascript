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
  this._packObjects(buffer, [this.replyToTopic, this.serviceId])
}

Request.prototype._unpackMessage = function (buffer) {
  Message.prototype._unpackMessage.call(this, buffer)
  this.replyToTopic = this._unpackObject(buffer)
  this.serviceId = this._unpackObject(buffer)
}

module.exports = Request
