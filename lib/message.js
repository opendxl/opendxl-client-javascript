'use strict'
var BufferList = require('bl')
var msgpack = require('msgpack5')()
var util = require('./util')

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

Message.MESSAGE_TYPE_REQUEST = 0
Message.MESSAGE_TYPE_RESPONSE = 1
Message.MESSAGE_TYPE_EVENT = 2
Message.MESSAGE_TYPE_ERROR = 3

Message.prototype._packObject = function (buffer, obj) {
  buffer.append(msgpack.encode(obj))
}

Message.prototype._unpackObject = function (buffer) {
  return msgpack.decode(buffer)
}

Message.prototype._packObjects = function (buffer, arr) {
  var index
  for (index = 0; index < arr.length; ++index) {
    this._packObject(buffer, arr[index])
  }
}

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

Message.prototype._packMessagev1 = function (buffer) {
  var otherFields = this.otherFields
  var otherFieldsAsArray = Object.keys(otherFields).reduce(
                            function (result, current) {
                              result.push(current, otherFields[current])
                              return result
                            }, [])
  this._packObject(buffer, otherFieldsAsArray)
}

Message.prototype._packMessagev2 = function (buffer) {
  this._packObjects(buffer, [
    this.sourceTenantGuid, this.destinationTenantGuids
  ])
}

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

Message.prototype._unpackMessage = function (raw) {
  this.messageId = this._unpackObject(raw)
  this.sourceClientId = this._unpackObject(raw)
  this.sourceBrokerId = this._unpackObject(raw)
  this.brokerIds = this._unpackObject(raw)
  this.clientIds = this._unpackObject(raw)
  this.payload = this._unpackObject(raw)
}

Message.prototype._unpackMessagev1 = function (raw) {
  var otherFields = {}
  var otherFieldsAsArray = this._unpackObject(raw)
  var index
  for (index = 0; index < otherFieldsAsArray.length; index += 2) {
    otherFields[otherFieldsAsArray[index]] = otherFieldsAsArray[index + 1]
  }
  this.otherFields = otherFields
}

Message.prototype._unpackMessagev2 = function (raw) {
  this.sourceTenantGuid = this._unpackObject(raw)
  this.destinationTenantGuids = this._unpackObject(raw)
}

module.exports = Message
