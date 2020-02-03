'use strict'

var inherits = require('inherits')
var Message = require('./message')

/**
 * @classdesc Response messages are sent by service instances upon
 *   receiving {@link Request} messages. Response messages are sent using the
 *   {@link Client#sendResponse} method of a client instance. Clients that are
 *   invoking the service (sending a request) will receive the response via
 *   the callback specified when invoking the {@link Client#asyncRequest}
 *   method.
 * @param {Request} request - The {@link Request} message that this is a
 *   response for.
 * @augments Message
 * @constructor
 */
function Response (request) {
  if (typeof (request) !== 'undefined' && request) {
    Message.call(this, request.replyToTopic)
    /**
     * The {@link Request} message that this is a response for.
     * @type {Request}
     * @name Response#request
     */
    this.request = request
    /**
     * Unique identifier (UUID) for the {@link Request} message that this
     * message is a response for. This is used by the invoking
     * {@link Client} to correlate an incoming {@link Response} message with
     * the {@link Request} message that was initially sent by the client.
     * @type {String}
     * @name Response#requestMessageId
     */
    this.requestMessageId = request.messageId
    /**
     * The identifier of the service that sent this response (the service that
     * the corresponding {@link Request} was routed to).
     * @type {string}
     * @name Response#serviceId
     */
    this.serviceId = request.serviceId

    if (request.sourceClientInstanceId) {
      this.clientIds = [request.sourceClientInstanceId]
    } else if (request.sourceClientId) {
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

/**
 * Pack bytes for this message onto the end of the supplied buffer.
 * @private
 * @param {BufferList} buffer - Buffer into which to pack the message bytes.
 */
Response.prototype._packMessage = function (buffer) {
  Message.prototype._packMessage.call(this, buffer)
  this._packObjects(buffer, [this.requestMessageId, this.serviceId])
}

/**
 * Unpack bytes from the supplied buffer into member variables for this
 * object.
 * @private
 * @param {BufferList} buffer - Buffer to unpack message bytes from.
 */
Response.prototype._unpackMessage = function (buffer) {
  Message.prototype._unpackMessage.call(this, buffer)
  this.requestMessageId = this._unpackObject(buffer)
  this.serviceId = this._unpackObject(buffer)
}

module.exports = Response
