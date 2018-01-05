'use strict'

var inherits = require('inherits')
var Message = require('./message')
var Response = require('./response')

/**
 * @classdesc ErrorResponse messages are sent by the DXL fabric itself or
 *   service instances upon receiving {@link Request} messages. The error
 *   response may indicate the inability to locate a service to handle the
 *   request or an internal error within the service itself. Error response
 *   messages are sent using the {@link Client#sendResponse} method of a client
 *   instance.
 * @param {Request} request - The {@link Request} message that this is a
 *   response for.
 * @param {Number} [errorCode=0] - The numeric error code.
 * @param {String=} errorMessage - The textual error message.
 * @constructor
 */
function ErrorResponse (request, errorCode, errorMessage) {
  if (typeof (errorCode) === 'undefined') { errorCode = 0 }
  if (typeof (errorMessage) === 'undefined') { errorMessage = '' }

  Response.call(this, request)
  this.errorCode = errorCode
  this.errorMessage = errorMessage

  this.messageType = Message.MESSAGE_TYPE_ERROR
}

inherits(ErrorResponse, Response)

/**
 * Pack bytes for this message onto the end of the supplied buffer.
 * @private
 * @param {BufferList} buffer - Buffer into which to pack the message bytes.
 */
ErrorResponse.prototype._packMessage = function (buffer) {
  Response.prototype._packMessage.call(this, buffer)
  this._packObjects(buffer, [this.errorCode, this.errorMessage])
}

/**
 * Unpack bytes from the supplied buffer into member variables for this
 * object.
 * @private
 * @param {BufferList} buffer - Buffer to unpack message bytes from.
 */
ErrorResponse.prototype._unpackMessage = function (buffer) {
  Response.prototype._unpackMessage.call(this, buffer)
  this.errorCode = this._unpackObject(buffer)
  this.errorMessage = this._unpackObject(buffer)
}

module.exports = ErrorResponse
