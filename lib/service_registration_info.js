'use strict'

var util = require('./util')

var DEFAULT_TTL = 60

function ServiceRegistrationInfo (client, serviceType) {
  this._callbacksByTopic = {}
  this.serviceType = serviceType
  this.destinationTenantGuids = []
  this.metadata = {}
  this.serviceId = util.generateIdAsString()
  this.ttl = DEFAULT_TTL
}

ServiceRegistrationInfo.prototype.addTopic = function (topic, callback) {
  var callbacks = this._callbacksByTopic[topic]
  if (!callbacks) {
    callbacks = []
    this._callbacksByTopic[topic] = callbacks
  }

  callbacks.push(callback)
}

Object.defineProperty(ServiceRegistrationInfo.prototype, 'topics', {
  get: function () { return Object.keys(this._callbacksByTopic) }
})

ServiceRegistrationInfo.prototype.callbacks = function (topic) {
  return this._callbacksByTopic[topic]
}

module.exports = ServiceRegistrationInfo
