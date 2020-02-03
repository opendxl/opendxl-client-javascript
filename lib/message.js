'use strict'

var Buffer = require('buffer').Buffer
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
  // DXL version 0 message format fields
  /**
   * The version of the DXL message (used to determine the features that are
   * available).
   * @default 4
   * @type {Number}
   * @name Message#version
   */
  this.version = 4
  /**
   * The numeric type of the message.
   * @type {Number}
   * @default null
   * @name Message#messageType
   */
  this.messageType = null
  /**
   * Unique identifier for the message (UUID).
   * @type {String}
   * @name Message#messageId
   */
  this.messageId = util.generateIdAsString()
  /**
   * The identifier of the DXL client that sent the message (set by the broker
   * that initially receives the message)
   * @type {string}
   * @default ''
   * @name Message#sourceClientId
   */
  this.sourceClientId = ''
  /**
   * The identifier of the DXL broker that the message's originating client is
   * connected to (set by the initial broker).
   * @type {string}
   * @default ''
   * @name Message#sourceBrokerId
   */
  this.sourceBrokerId = ''
  /**
   * The topic to publish the message to.
   * @type {String}
   * @name Message#destinationTopic
   */
  this.destinationTopic = destinationTopic
  /**
   * The application-specific payload of the message.
   * @type {(Buffer|String)}
   * @default ''
   * @name Message#payload
   */
  this.payload = ''
  /**
   * The set of broker identifiers that the message is to be routed to. Setting
   * this value will limit which brokers the message will be delivered to. This
   * can be used in conjunction with {@link Message#clientIds}.
   * @type {Array<String>}
   * @default []
   * @name Message#brokerIds
   */
  this.brokerIds = []
  /**
   * The set of client identifiers that the message is to be routed to. Setting
   * this value will limit which clients the message will be delivered to. This
   * can be used in conjunction with {@link Message#brokerIds}.
   * @type {Array<String>}
   * @default []
   * @name Message#clientIds
   */
  this.clientIds = []

  // DXL version 1 message format fields
  /**
   * Returns an object containing the set of additional fields associated with
   * the message. These fields can be used to add "header" like values to the
   * message without requiring modifications to be made to the payload.
   * @type {Object}
   * @default {}
   * @name Message#otherFields
   */
  this.otherFields = {}

  // DXL version 2 message format fields
  /**
   * The tenant identifier of the DXL client that sent the message
   * (set by the broker that initially receives the message).
   * @type {String}
   * @default ''
   * @name Message#sourceTenantGuid
   */
  this.sourceTenantGuid = ''
  /**
   * The set of tenant identifiers that the message is to be routed to. Setting
   * this value will limit which clients the message will be delivered to. This
   * can be used in conjunction with {@link Message#brokerIds} and
   * {@link Message#clientIds}.
   * @type {Array<String>}
   * @default []
   * @name Message#destinationTenantGuids
   */
  this.destinationTenantGuids = []

  // DXL version 3 message format fields
  /**
   * The instance identifier for the client that is the source of the message.
   * @type {string}
   * @default ''
   * @name Message#sourceClientInstanceId
   */
  this.sourceClientInstanceId = ''
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
 * Unpack a binary-type object from the supplied {@link BufferList}. Unlike the
 * {@link msgpack#decode} method, this method treats a leading str format type
 * on the object as though it were a bin format. This method should be invoked
 * in cases where the decoded object must be a bin type - for example, the
 * {@link Message#payload} - even if the DXL broker may encode the object in a
 * str format.
 * @private
 * @param {BufferList} buffer - Buffer from which to unpack the next object.
 * @returns {Object} The unpacked object.
 * @throws {msgpack#IncompleteBufferError} If the buffer does not contain
 *   a properly formed str or bin format type object.
 */
Message.prototype._unpackBinObject = function (buffer) {
  var decodedObject = null
  var bufLength = buffer.length

  if (bufLength <= 0) {
    throw new msgpack.IncompleteBufferError()
  }

  var dataLength = -1
  var dataOffset = 0
  var first = buffer.readUInt8(0)

  if ((first & 0xe0) === 0xa0) {
    // fixstr byte array with length up to 31 bytes
    dataOffset = 1
    dataLength = first & 0x1f
  } else if ((first === 0xd9) || (first === 0xc4)) {
    // bin/str byte array with length up to (2^8)-1 bytes
    dataOffset = 2
    if (bufLength >= dataOffset) {
      dataLength = buffer.readUInt8(1)
    }
  } else if ((first === 0xda) || (first === 0xc5)) {
    // bin/str byte array with length up to (2^16)-1 bytes
    dataOffset = 3
    if (bufLength >= dataOffset) {
      dataLength = buffer.readUInt16BE(1)
    }
  } else if ((first === 0xdb) || (first === 0xc6)) {
    // bin/str byte array with length up to (2^32)-1 bytes
    dataOffset = 5
    if (bufLength >= dataOffset) {
      dataLength = buffer.readUInt32BE(1)
    }
  }

  if ((dataLength >= 0) && (bufLength >= dataLength + dataOffset)) {
    decodedObject = buffer.slice(dataOffset, dataLength + dataOffset)
    buffer.consume(dataLength + dataOffset)
  } else {
    throw new msgpack.IncompleteBufferError()
  }

  return decodedObject
}

/**
 * Pack bytes for the supplied array of object onto the end of the supplied
 * buffer.
 * @private
 * @param {BufferList} buffer - Buffer into which to pack the message bytes.
 * @param {Array<Object>} arr - Array of objects to pack into the buffer.
 */
Message.prototype._packObjects = function (buffer, arr) {
  for (var index = 0; index < arr.length; index++) {
    this._packObject(buffer, arr[index])
  }
}

/**
 * Convert the supplied payload to a Buffer or String. If the parameter is a
 * already a Buffer or String, the text parameter is returned as-is. If the
 * parameter is anything else, e.g., an Object, a String representation of
 * the parameter is returned.
 * @private
 * @param {(Object|String)} payload - The text to convert.
 * @returns {(Buffer|String)} Buffer or string representation of the payload.
 */

function payloadAsBufferOrString (payload) {
  var returnValue = payload
  if (!Buffer.isBuffer(returnValue)) {
    if (typeof payload === 'object') {
      returnValue = JSON.stringify(payload)
    } else if (typeof payload !== 'string') {
      returnValue = '' + payload
    }
  }
  return returnValue
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
    payloadAsBufferOrString(this.payload)
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
 * Pack bytes for DXL version 3 message fields onto the end of the supplied
 * buffer.
 * @private
 * @param {BufferList} buffer - Buffer into which to pack the message bytes.
 */
Message.prototype._packMessagev3 = function (buffer) {
  this._packObjects(buffer, [
    this.sourceClientInstanceId
  ])
}

/**
 * Pack bytes for DXL version 4 message fields onto the end of the supplied
 * buffer.
 * Message version 4 contains no generic message headers.
 * @private
 * @param {BufferList} buffer - Buffer into which to pack the message bytes.
 */
Message.prototype._packMessagev4 = function (buffer) {
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
  if (this.version > 2) {
    this._packMessagev3(buffer)
  }
  if (this.version > 3) {
    this._packMessagev4(buffer)
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
  // Call _unpackBinObject() instead of _unpackObject() because the data type
  // is expected to be "binary" even if the broker happened to encode it
  // as a str-format type. _unpackObject() would attempt to decode a str-format
  // type object as a utf-8 formatted string.
  this.payload = this._unpackBinObject(raw)
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

/**
 * Unpack bytes from the supplied buffer for DXL version 3 fields into member
 * variables for this object.
 * @private
 * @param {BufferList} raw - Buffer to unpack message bytes from.
 */
Message.prototype._unpackMessagev3 = function (raw) {
  this.sourceClientInstanceId = this._unpackObject(raw)
}

/**
 * Unpack bytes from the supplied buffer for DXL version 4 fields into member
 * variables for this object.
 * Message version 4 contains no generic message headers.
 * @private
 * @param {BufferList} raw - Buffer to unpack message bytes from.
 */
Message.prototype._unpackMessagev4 = function (raw) {
}

module.exports = Message
