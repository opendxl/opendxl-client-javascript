'use strict'
var inherits = require('inherits')
var Message = require('./message')

function Event (destinationTopic) {
  Message.call(this, destinationTopic)
  this.messageType = Message.MESSAGE_TYPE_EVENT
}

inherits(Event, Message)

module.exports = Event
