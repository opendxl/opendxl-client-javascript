'use strict'

const BufferList = require('bl')
const DxlError = require('./dxl-error')
const msgpack = require('msgpack5')()
const message = require('./message')
const errorResponse = require('./error-response')
const event = require('./event')
const request = require('./request')
const response = require('./response')

const messageTypeToFunction = {}
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

  const version = msgpack.decode(raw)
  const messageType = msgpack.decode(raw)
  const MessageClass = messageTypeToFunction[messageType]

  if (!MessageClass) {
    throw new DxlError('Unknown message type: ' + messageType)
  }

  const message = new MessageClass()
  message.version = version
  message._unpackMessage(raw)
  if (version > 0) {
    message._unpackMessagev1(raw)
  }
  if (version > 1) {
    message._unpackMessagev2(raw)
  }

  return message
}

module.exports = DecodeMessage
