'use strict'

var inherits = require('inherits')
var Message = require('./message')

/**
 * @classdesc Event messages are sent using the {@link Client#sendEvent} method
 *   of a client instance. Event messages are sent by one publisher and received
 *   by one or more recipients that are currently subscribed to the
 *   {@link Message#destinationTopic} associated with the event (otherwise
 *   known as one-to-many).
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
