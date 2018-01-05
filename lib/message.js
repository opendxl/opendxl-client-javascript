'use strict'

var BufferList = require('bl')
var msgpack = require('msgpack5')()
var util = require('./util')

/**
 * @classdesc Base class for the different Data Exchange Layer (DXL) message
 *   types.
 * @param {String} destinationTopic - The topic to publish the event to.
 * @constructor
 */
function Message (destinationTopic) {
  // Version 0
  this.version = 2
  this.messageType = null
  this.messageId = util.generateIdAsString()
  this.sourceClientId = ''
  this.sourceBrokerId = ''
  this.destinationTopic = destinationTopic
  this.payload = ''
  this.brokerIds = []
  this.clientIds = []

  // Version 1
  this.otherFields = {}

  // Version 2
  this.sourceTenantGuid = ''
  this.destinationTenantGuids = []
}

/**
 * Numeric type identifier for the {@link Request} message type.
 * @type {number}
 */
Message.MESSAGE_TYPE_REQUEST = 0

/**
 * Numeric type identifier for the {@link Response} message type.
 * @type {number}
 */
Message.MESSAGE_TYPE_RESPONSE = 1

/**
 * Numeric type identifier for the {@link Event} message type.
 * @type {number}
 */
Message.MESSAGE_TYPE_EVENT = 2

/**
 * Numeric type identifier for the {@link ErrorResponse} message type.
 * @type {number}
 */
Message.MESSAGE_TYPE_ERROR = 3

/**
 * Pack bytes for the supplied object onto the end of the supplied buffer.
 * @private
 * @param {BufferList} buffer - Buffer into which to pack the message bytes.
 * @param {Object} obj - Object to pack into the buffer.
 */
Message.prototype._packObject = function (buffer, obj) {
  buffer.append(msgpack.encode(obj))
}

/**
 * Unpack an object from the bytes at the beginning of the supplied buffer.
 * @private
 * @param {BufferList} buffer - Buffer from which to unpack the next object.
 * @returns {Object} The unpacked object.
 */
Message.prototype._unpackObject = function (buffer) {
  return msgpack.decode(buffer)
}

/**
 * Pack bytes for the supplied array of object onto the end of the supplied
 * buffer.
 * @private
 * @param {BufferList} buffer - Buffer into which to pack the message bytes.
 * @param {Array<Object>} arr - Array of objects to pack into the buffer.
 */
Message.prototype._packObjects = function (buffer, arr) {
  for (var index = 0; index < arr.length; ++index) {
    this._packObject(buffer, arr[index])
  }
}

/**
 * Pack bytes for this message onto the end of the supplied buffer.
 * @private
 * @param {BufferList} buffer - Buffer into which to pack the message bytes.
 */
Message.prototype._packMessage = function (buffer) {
  this._packObjects(buffer, [
    this.messageId,
    this.sourceClientId,
    this.sourceBrokerId,
    this.brokerIds,
    this.clientIds,
    this.payload
  ])
}

/**
 * Pack bytes for DXL version 1 message fields onto the end of the supplied
 * buffer.
 * @private
 * @param {BufferList} buffer - Buffer into which to pack the message bytes.
 */
Message.prototype._packMessagev1 = function (buffer) {
  var otherFields = this.otherFields
  var otherFieldsAsArray = Object.keys(otherFields).reduce(
                            function (result, current) {
                              result.push(current, otherFields[current])
                              return result
                            }, [])
  this._packObject(buffer, otherFieldsAsArray)
}

/**
 * Pack bytes for DXL version 2 message fields onto the end of the supplied
 * buffer.
 * @private
 * @param {BufferList} buffer - Buffer into which to pack the message bytes.
 */
Message.prototype._packMessagev2 = function (buffer) {
  this._packObjects(buffer, [
    this.sourceTenantGuid, this.destinationTenantGuids
  ])
}

/**
 * Converts the message into a buffer and returns it.
 * @private
 * @returns {Buffer} The converted message.
 */
Message.prototype._toBytes = function () {
  var buffer = new BufferList()
  this._packObject(buffer, this.version)
  this._packObject(buffer, this.messageType)
  this._packMessage(buffer)
  if (this.version > 0) {
    this._packMessagev1(buffer)
  }
  if (this.version > 1) {
    this._packMessagev2(buffer)
  }
  return buffer.slice()
}

/**
 * Unpack bytes from the supplied buffer into member variables for this
 * object.
 * @private
 * @param {BufferList} raw - Buffer to unpack message bytes from.
 */
Message.prototype._unpackMessage = function (raw) {
  this.messageId = this._unpackObject(raw)
  this.sourceClientId = this._unpackObject(raw)
  this.sourceBrokerId = this._unpackObject(raw)
  this.brokerIds = this._unpackObject(raw)
  this.clientIds = this._unpackObject(raw)
  this.payload = this._unpackObject(raw)
}

/**
 * Unpack bytes from the supplied buffer for DXL version 1 fields into member
 * variables for this object.
 * @private
 * @param {BufferList} raw - Buffer to unpack message bytes from.
 */
Message.prototype._unpackMessagev1 = function (raw) {
  var otherFields = {}
  var otherFieldsAsArray = this._unpackObject(raw)
  for (var index = 0; index < otherFieldsAsArray.length; index += 2) {
    otherFields[otherFieldsAsArray[index]] = otherFieldsAsArray[index + 1]
  }
  this.otherFields = otherFields
}

/**
 * Unpack bytes from the supplied buffer for DXL version 2 fields into member
 * variables for this object.
 * @private
 * @param {BufferList} raw - Buffer to unpack message bytes from.
 */
Message.prototype._unpackMessagev2 = function (raw) {
  this.sourceTenantGuid = this._unpackObject(raw)
  this.destinationTenantGuids = this._unpackObject(raw)
}

module.exports = Message
