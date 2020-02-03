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
 * @augments Message
 * @constructor
 */
function Request (destinationTopic) {
  Message.call(this, destinationTopic)
  this.messageType = Message.MESSAGE_TYPE_REQUEST
  /**
   * The topic that the {@link Response} to this request will be sent to.
   * @type {string}
   * @default ''
   * @name Request#replyToTopic
   */
  this.replyToTopic = ''
  /**
   * The identifier of the service that this request will be routed to. If an
   * identifier is not specified, the initial broker that receives the request
   * will select the service to handle the request (round-robin by default).
   * @type {string}
   * @default ''
   * @name Request#serviceId
   */
  this.serviceId = ''

  // DXL version 4 message format fields

  /**
   * Whether the request is targeting multiple services. A multi-service request
   * will receive a response from one service of each type servicing the request
   * topic.
   * @type {boolean]
   * @default false
   * @name Request#isMultiService
   */
  this.isMultiService = false
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

/**
 * Unpack bytes from the supplied buffer for DXL version 4 fields into member
 * variables for this object.
 * @private
 * @param {BufferList} raw - Buffer to unpack message bytes from.
 */
Request.prototype._unpackMessagev4 = function (raw) {
  Message.prototype._unpackMessagev4.call(this, raw)
  this.isMultiService = this._unpackObject(raw) === 1
}

/**
 * Pack bytes for DXL version 4 message fields onto the end of the supplied
 * buffer.
 * @private
 * @param {BufferList} buffer - Buffer into which to pack the message bytes.
 */
Request.prototype._packMessagev4 = function (buffer) {
  Message.prototype._packMessagev4.call(this, buffer)
  this._packObjects(buffer, [this.isMultiService ? 1 : 0])
}

module.exports = Request
