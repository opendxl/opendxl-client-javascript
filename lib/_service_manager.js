'use strict'

var error = require('./error')
var Request = require('./request')

var DXL_SERVICE_REGISTER_REQUEST_TOPIC =
  '/mcafee/service/dxl/svcregistry/register'
var DXL_SERVICE_UNREGISTER_REQUEST_TOPIC =
  '/mcafee/service/dxl/svcregistry/unregister'

function _ServiceManager (client) {
  // jshint validthis: true
  this.client = client
  this.services = {}
}

function registerService (client, service) {
  var request = new Request(DXL_SERVICE_REGISTER_REQUEST_TOPIC)
  request.payload = JSON.stringify({
    serviceType: service.info.serviceType,
    metaData: service.info.metadata,
    requestChannels: service.info.topics,
    ttlMins: service.info.ttl,
    serviceGuid: service.info.serviceId
  })
  request.destinationTenantGuids = service.info.destinationTenantGuids
  client.asyncRequest(request,
    function (response) {
      if (service.callback) {
        service.callback(response)
        service.callback = null
      }
    })
}

function unregisterService (client, serviceRegInfo, callback) {
  if (client.connected) {
    var request = new Request(DXL_SERVICE_UNREGISTER_REQUEST_TOPIC)
    request.payload = JSON.stringify({
      serviceGuid: serviceRegInfo.serviceId})
    client.asyncRequest(request,
      callback ? function (response) { callback(response) } : null)
  }

  serviceRegInfo.topics.forEach(function (topic) {
    serviceRegInfo.callbacks(topic).forEach(function (callback) {
      client.removeRequestCallback(topic, callback)
    })
  })
}

_ServiceManager.prototype.registerServiceAsync = function (
  serviceRegInfo, registrationCallback) {
  var that = this

  var service = {
    info: serviceRegInfo,
    callback: registrationCallback
  }

  if (this.services[serviceRegInfo.serviceId]) {
    throw new error.DxlError('Service already registered for id: ' +
      serviceRegInfo.serviceId)
  }
  this.services[serviceRegInfo.serviceId] = service

  if (this.client.connected) {
    registerService(this.client, service)
  }

  serviceRegInfo.topics.forEach(function (topic) {
    serviceRegInfo.callbacks(topic).forEach(function (callback) {
      that.client.addRequestCallback(topic, callback, true)
    })
  })
}

_ServiceManager.prototype.unregisterServiceAsync = function (
  serviceRegInfo, unregistrationCallback) {
  if (this.services[serviceRegInfo.serviceId]) {
    delete this.services[serviceRegInfo.serviceId]
    unregisterService(this.client, serviceRegInfo, unregistrationCallback)
  }
}

_ServiceManager.prototype.onConnected = function () {
  var that = this

  Object.keys(this.services).forEach(function (serviceId) {
    registerService(that.client, that.services[serviceId])
  })
}

_ServiceManager.prototype.destroy = function () {
  var that = this
  Object.keys(this.services).forEach(function (serviceId) {
    unregisterService(that.client, that.services[serviceId].info)
  })
}

module.exports = _ServiceManager
