'use strict'

var inherits = require('inherits')
var Message = require('./message')

/**
 * @classdesc Event messages are sent using the {@link Client#sendEvent} method
 *   of a client instance.
 * @param {String} destinationTopic - The topic to publish the event to.
 * @augments Message
 * @constructor
 */
function Event (destinationTopic) {
  Message.call(this, destinationTopic)
  this.messageType = Message.MESSAGE_TYPE_EVENT
}

inherits(Event, Message)

module.exports = Event
