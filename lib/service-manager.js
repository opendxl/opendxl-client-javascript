'use strict'

var DxlError = require('./dxl-error')
var ErrorResponse = require('./error-response')
var Request = require('./request')

var DXL_SERVICE_REGISTER_REQUEST_TOPIC =
  '/mcafee/service/dxl/svcregistry/register'
var DXL_SERVICE_UNREGISTER_REQUEST_TOPIC =
  '/mcafee/service/dxl/svcregistry/unregister'
var DXL_SERVICE_UNAVAILABLE_ERROR_CODE = 0x80000001
var DXL_SERVICE_UNAVAILABLE_ERROR_MESSAGE =
  'unable to locate service for request'

/**
 * @classdesc Manager which registers services with the DXL fabric. The
 *   manager re-registers services with the fabric each time that the client
 *   is reconnected or as the {@link ServiceRegistrationInfo#ttl} for the
 *   service's {@link ServiceRegistrationInfo} object expires.
 * @private
 * @param {Client} client - Client to be used for registering services.
 * @constructor
 */
function ServiceManager (client) {
  var that = this

  /**
   * The {@link Client} to be used for registering services.
   * @type {Client}
   * @name ServiceManager#_client
   * @private
   */
  this._client = client
  /**
   * An object which maps a service's {@link ServiceRegistrationInfo#serviceId}
   * key to a value containing a separate object with information for the
   * service.
   * @type {Object}
   * @example
   * var this._services = {}
   * var serviceRegInfo = new ServiceRegistrationInfo(client, 'myService')
   * this._services[serviceRegInfo.serviceId] = {
   *   info: serviceRegInfo,
   *   onFirstRegistrationCallback: function () {
   *     console.log('registered!')},
   *   callbacksByTopic: {
   *     topic1: function () { console.log('received!') }
   *   },
   *   ttlTimeout: setTimeout(function () {
   *     console.log('reregister!')},
    *    serviceRegInfo.ttl * 60 * 1000) }
   * @name ServiceManager#_services
   * @default ''
   * @private
   */
  this._services = {}

  this._client.addRequestCallback('', function (request) {
    if (request.serviceId && !that._services[request.serviceId]) {
      var response = new ErrorResponse(request,
        DXL_SERVICE_UNAVAILABLE_ERROR_CODE,
        DXL_SERVICE_UNAVAILABLE_ERROR_MESSAGE)
      that._client.sendResponse(response)
    }
  })
}

/**
 * Clear the timeout handler used to re-register the service when its
 * {@link ServiceRegistrationInfo#ttl} expires.
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
 *   re-register the service when its {@link ServiceRegistrationInfo#ttl}
 *   expires.
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
      function (error) {
        if (service.onFirstRegistrationCallback) {
          service.onFirstRegistrationCallback(error)
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
      unregisterCallback = function (error) { callback(error) }
    }
    client.asyncRequest(request, unregisterCallback)
  }

  Object.keys(service.callbacksByTopic).forEach(function (topic) {
    service.callbacksByTopic[topic].forEach(function (callback) {
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
    callbacksByTopic: {},
    ttlTimeout: null
  }

  if (this._services[serviceRegInfo.serviceId]) {
    throw new DxlError('Service already registered for id: ' +
      serviceRegInfo.serviceId)
  }
  this._services[serviceRegInfo.serviceId] = service

  registerService(this._client, service)

  serviceRegInfo.topics.forEach(function (topic) {
    service.callbacksByTopic[topic] = serviceRegInfo.callbacks(topic).map(
      function (callback) {
        var wrappedCallback = function (request) {
          // If the request message has been tagged for a service id which
          // does not match the service id of the registered callback,
          // ignore the message.
          if (!request.serviceId ||
            (request.serviceId === serviceRegInfo.serviceId)) {
            callback(request)
          }
        }
        that._client.addRequestCallback(topic, wrappedCallback, true)
        return wrappedCallback
      }
    )
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
  var service = this._services[serviceRegInfo.serviceId]
  if (service) {
    delete this._services[serviceRegInfo.serviceId]
    unregisterService(this._client, service, callback)
  }
}

/**
 * Invoked when the client has become connected. Registers active services
 * with the DXL fabric.
 */
ServiceManager.prototype.onConnected = function () {
  var that = this

  Object.keys(this._services).forEach(function (serviceId) {
    registerService(that._client, that._services[serviceId])
  })
}

/**
 * Destroys resources for all active service registrations. Active services
 * are unregistered from the DXL fabric.
 */
ServiceManager.prototype.destroy = function () {
  var that = this
  Object.keys(this._services).forEach(function (serviceId) {
    unregisterService(that._client, that._services[serviceId])
  })
  this._services = {}
}

module.exports = ServiceManager
