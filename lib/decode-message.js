'use strict'

var BufferList = require('bl')
var DxlError = require('./dxl-error')
var msgpack = require('msgpack5')()
var message = require('./message')
var errorResponse = require('./error-response')
var event = require('./event')
var request = require('./request')
var response = require('./response')

var messageTypeToFunction = {}
messageTypeToFunction[message.MESSAGE_TYPE_ERROR] = errorResponse
messageTypeToFunction[message.MESSAGE_TYPE_EVENT] = event
messageTypeToFunction[message.MESSAGE_TYPE_REQUEST] = request
messageTypeToFunction[message.MESSAGE_TYPE_RESPONSE] = response

/**
 * Decodes a raw buffer into a {@link Message} object.
 * @private
 * @param {(String|Buffer|BufferList)} raw - Raw buffer to decode.
 * @returns {Message} The decoded message.
 * @constructor
 */
function DecodeMessage (raw) {
  if (!(raw instanceof BufferList)) {
    raw = new BufferList(raw)
  }

  var version = msgpack.decode(raw)
  var messageType = msgpack.decode(raw)
  var MessageClass = messageTypeToFunction[messageType]

  if (!MessageClass) {
    throw new DxlError('Unknown message type: ' + messageType)
  }

  var message = new MessageClass()
  message.version = version
  message._unpackMessage(raw)
  if (version > 0) {
    message._unpackMessagev1(raw)
  }
  if (version > 1) {
    message._unpackMessagev2(raw)
  }
  if (version > 2) {
    message._unpackMessagev3(raw)
  }
  if (version > 3) {
    message._unpackMessagev4(raw)
  }

  return message
}

module.exports = DecodeMessage
