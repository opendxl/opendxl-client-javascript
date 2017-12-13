'use strict'

var BufferList = require('bl')
var msgpack = require('msgpack5')()
var message = require('./message')
var error = require('./error')
var errorResponse = require('./error_response')
var event = require('./event')
var request = require('./request')
var response = require('./response')

var messageTypeToFunction = {}
messageTypeToFunction[message.MESSAGE_TYPE_ERROR] = errorResponse
messageTypeToFunction[message.MESSAGE_TYPE_EVENT] = event
messageTypeToFunction[message.MESSAGE_TYPE_REQUEST] = request
messageTypeToFunction[message.MESSAGE_TYPE_RESPONSE] = response

function _DecodeMessage (raw) {
  if (!(raw instanceof BufferList)) {
    raw = new BufferList(raw)
  }

  var version = msgpack.decode(raw)
  var messageType = msgpack.decode(raw)
  var MessageClass = messageTypeToFunction[messageType]

  if (!MessageClass) {
    throw new error.DxlError('Unknown message type: ' + messageType)
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

  return message
}

module.exports = _DecodeMessage
