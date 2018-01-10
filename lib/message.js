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
  // DXL version 0 message format fields
  /**
   * The version of the DXL message (used to determine the features that are
   * available).
   * @default 2
   * @type {Number}
   * @name Message#version
   */
  this.version = 2
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
