'use strict'

var inherits = require('inherits')
var Message = require('./message')

/**
 * @classdesc Request messages are sent using the {@link Client#asyncRequest}
 *   method of a client instance. Request messages are used when invoking a
 *   method on a remote service. This communication is one-to-one where a
 *   client sends a request to a service instance and in turn receives a
 *   response.
 * @param {String} destinationTopic - The topic to publish the event to.
 * @constructor
 */
function Request (destinationTopic) {
  Message.call(this, destinationTopic)
  this.messageType = Message.MESSAGE_TYPE_REQUEST
  this.replyToTopic = ''
  this.serviceId = ''
}

inherits(Request, Message)

/**
 * Pack bytes for this message onto the end of the supplied buffer.
 * @private
 * @param {BufferList} buffer - Buffer into which to pack the message bytes.
 */
Request.prototype._packMessage = function (buffer) {
  Message.prototype._packMessage.call(this, buffer)
  this._packObjects(buffer, [this.replyToTopic, this.serviceId])
}

/**
 * Unpack bytes from the supplied buffer into member variables for this
 * object.
 * @private
 * @param {BufferList} buffer - Buffer to unpack message bytes from.
 */
Request.prototype._unpackMessage = function (buffer) {
  Message.prototype._unpackMessage.call(this, buffer)
  this.replyToTopic = this._unpackObject(buffer)
  this.serviceId = this._unpackObject(buffer)
}

module.exports = Request
