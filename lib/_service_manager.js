'use strict'

var Request = require('./request')

const DXL_SERVICE_REGISTER_REQUEST_TOPIC =
  '/mcafee/service/dxl/svcregistry/register'
const DXL_SERVICE_UNREGISTER_REQUEST_TOPIC =
  '/mcafee/service/dxl/svcregistry/unregister'

function _ServiceManager (client) {
  this.client = client
  this.services = {}
}

function registerService (service) {
  var request = new Request(DXL_SERVICE_REGISTER_REQUEST_TOPIC)
  request.payload = JSON.stringify({
    serviceType: service.info.serviceType,
    metaData: service.info.metadata,
    requestChannels: service.info.topics,
    ttlMins: service.info.ttl,
    serviceGuid: service.info.serviceId
  })
  request.destinationTenantGuids = service.info.destinationTenantGuids
  this.client.asyncRequest(request,
    function (response) {
      if (service.callback) {
        service.callback(response)
        service.callback = null
      }
    })
}

_ServiceManager.prototype.registerServiceAsync = function (
  serviceRegInfo, registrationCallback) {
  var that = this

  var service = {
    info: serviceRegInfo,
    callback: registrationCallback
  }
  this.services[serviceRegInfo.serviceId] = service

  if (this.client.connected) {
    registerService.call(this, service)
  }

  serviceRegInfo.topics.forEach(function (topic) {
    serviceRegInfo.callbacks(topic).forEach(function (callback) {
      that.client.addRequestCallback(topic, callback, true)
    })
  })
}

_ServiceManager.prototype.onConnected = function () {
  var that = this

  Object.keys(this.services).forEach(function (serviceId) {
    registerService.call(that, that.services[serviceId])
  })
}

_ServiceManager.prototype.destroy = function () {
  var that = this

  Object.keys(this.services).forEach(function (serviceId) {
    var request = new Request(DXL_SERVICE_UNREGISTER_REQUEST_TOPIC)
    request.payload = JSON.stringify({
      serviceGuid: that.services[serviceId].info.serviceId})
    that.client.asyncRequest(request)
  })
}

module.exports = _ServiceManager
