'use strict'

var DxlError = require('./dxl_error')
var Request = require('./request')

var DXL_SERVICE_REGISTER_REQUEST_TOPIC =
  '/mcafee/service/dxl/svcregistry/register'
var DXL_SERVICE_UNREGISTER_REQUEST_TOPIC =
  '/mcafee/service/dxl/svcregistry/unregister'

/**
 * @classdesc Manager which registers services with the DXL fabric. The
 *   manager re-registers services with the fabric each time that the client
 *   is reconnected or as the _ttl_ for the service's
 *   {@link ServiceRegistrationInfo} object expires.
 * @private
 * @param {Client} client - Client to be used for registering services.
 * @constructor
 */
function ServiceManager (client) {
  this.client = client
  this.services = {}
}

/**
 * Clear the timeout handler used to re-register the service when its _ttl_
 * expires.
 * @private
 * @param {Object} service - Metadata for the service.
 * @param {ServiceRegistrationInfo} service.info - Info supplied for the
 *   service registration via a call to the
 *   {@link ServiceManager#registerServiceAsync} function.
 * @param {Object} service.ttlTimeout - Id for the service's ttl callback.
 */
function clearTtlTimeout (service) {
  if (service.ttlTimeout) {
    clearTimeout(service.ttlTimeout)
  }
}

/**
 * Registers the service with the DXL fabric.
 * @private
 * @param {Client} client - Client to be used for registering the service.
 * @param {Object} service - Metadata for the service.
 * @param {ServiceRegistrationInfo} service.info - Info supplied for the
 *   service registration via a call to the
 *   {@link ServiceManager#registerServiceAsync} function.
 * @param {Function} [service.onFirstRegistrationCallback=null] - An optional
 *   callback that will be invoked when the initial registration attempt is
 *   complete. If an error occurs during the registration attempt, the first
 *   parameter supplied to the callback contains an {@link Error} with failure
 *   details.
 * @param {Object} service.ttlTimeout - Id for a callback to be invoked to
 *   re-register the service when its _ttl_ expires.
 */
function registerService (client, service) {
  clearTtlTimeout(service)

  if (client.connected) {
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
      function (error, response) {
        if (service.onFirstRegistrationCallback) {
          service.onFirstRegistrationCallback(error, response)
          service.onFirstRegistrationCallback = null
        }
      })

    service.ttlTimeout = setTimeout(registerService,
      service.info.ttl * 60 * 1000, client, service)
  }
}

/**
 * Unregisters the service from the DXL fabric.
 * @private
 * @param {Client} client - Client to be used for unregistering the service.
 * @param {Object} service - Metadata for the service.
 * @param {ServiceRegistrationInfo} service.info - Info supplied for the
 *   service registration via a call to the
 *   {@link ServiceManager#registerServiceAsync} function.
 * @param {Object} service.ttlTimeout - Id for the service's ttl callback.
 * @param {Function} [callback=null] - An optional callback that will be
 *   invoked when the unregistration attempt is complete. If an error occurs
 *   during the unregistration attempt, the first parameter supplied to the
 *   callback contains an {@link Error} with failure details.
 */
function unregisterService (client, service, callback) {
  if (client.connected) {
    var request = new Request(DXL_SERVICE_UNREGISTER_REQUEST_TOPIC)
    request.payload = JSON.stringify({
      serviceGuid: service.info.serviceId})
    var unregisterCallback = null
    if (callback) {
      unregisterCallback = function (error, response) {
        callback(error, response)
      }
    }
    client.asyncRequest(request, unregisterCallback)
  }

  service.info.topics.forEach(function (topic) {
    service.info.callbacks(topic).forEach(function (callback) {
      client.removeRequestCallback(topic, callback)
    })
  })

  clearTtlTimeout(service)
}

/**
 * Registers the service with the DXL fabric if the client is connected. If the
 * client is not connected, the registration is performed when the client next
 * becomes connected.
 * @param {ServiceRegistrationInfo} serviceRegInfo - A
 *   {@link ServiceRegistrationInfo} instance containing information about the
 *   service that is to be registered.
 * @param {Function} [callback=null] - An optional callback that will be
 *   invoked when the registration attempt is complete. If an error occurs
 *   during the registration attempt, the first parameter supplied to the
 *   callback contains an {@link Error} with failure details.
 */
ServiceManager.prototype.registerServiceAsync = function (
    serviceRegInfo, callback) {
  var that = this

  var service = {
    info: serviceRegInfo,
    onFirstRegistrationCallback: callback,
    ttlTimeout: null
  }

  if (this.services[serviceRegInfo.serviceId]) {
    throw new DxlError('Service already registered for id: ' +
      serviceRegInfo.serviceId)
  }
  this.services[serviceRegInfo.serviceId] = service

  registerService(this.client, service)

  serviceRegInfo.topics.forEach(function (topic) {
    serviceRegInfo.callbacks(topic).forEach(function (callback) {
      that.client.addRequestCallback(topic, callback, true)
    })
  })
}

/**
 * Unregisters the service from the DXL fabric if the client is connected.
 * @param {ServiceRegistrationInfo} serviceRegInfo - A
 *   {@link ServiceRegistrationInfo} instance containing information about the
 *   service that is to be unregistered.
 * @param {Function} [callback=null] - An optional callback that will be
 *   invoked when the unregistration attempt is complete. If an error occurs
 *   during the unregistration attempt, the first parameter supplied to the
 *   callback contains an {@link Error} with failure details.
 */
ServiceManager.prototype.unregisterServiceAsync = function (
  serviceRegInfo, callback) {
  var service = this.services[serviceRegInfo.serviceId]
  if (service) {
    delete this.services[serviceRegInfo.serviceId]
    unregisterService(this.client, service, callback)
  }
}

/**
 * Invoked when the client has become connected. Registers active services with
 * the DXL fabric.
 */
ServiceManager.prototype.onConnected = function () {
  var that = this

  Object.keys(this.services).forEach(function (serviceId) {
    registerService(that.client, that.services[serviceId])
  })
}

/**
 * Destroys resources for all active service registrations. Active services
 * are unregistered from the DXL fabric.
 */
ServiceManager.prototype.destroy = function () {
  var that = this
  Object.keys(this.services).forEach(function (serviceId) {
    unregisterService(that.client, that.services[serviceId])
  })
  this.services = {}
}

module.exports = ServiceManager
