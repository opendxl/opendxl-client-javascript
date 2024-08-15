'use strict'

const util = require('./util')

const DEFAULT_TTL = 60

/**
 * @classdesc Service registration instances are used to register and expose
 * services onto a DXL fabric.
 *
 * DXL Services are exposed to the DXL fabric and are invoked in a fashion
 * similar to RESTful web services. Communication between an invoking client
 * and the DXL service is one-to-one (request/response).
 *
 * Each service is identified by the "topics" it responds to. Each of these
 * "topics" can be thought of as a method that is being "invoked" on the
 * service by the remote client.
 *
 * Multiple service "instances" can be registered with the DXL fabric that
 * respond to the same "topics". When this occurs (unless explicitly overridden
 * by the client) the fabric will select the particular instance to route the
 * request to (by default round-robin). Multiple service instances can be used
 * to increase scalability and fault-tolerance.
 *
 * The following demonstrates registering a service that responds to a single
 * topic with the DXL fabric. After registering the service, the example
 * invokes the request via the use of the {@link Client#asyncRequest} method.
 * @example
 * // Create service registration object
 * var info = new dxl.ServiceRegistrationInfo(client, 'myService')
 * // Add a topic for the service to respond to
 * info.addTopic(SERVICE_TOPIC,
 *   // Handle the receipt of an incoming service request
 *   function (request) {
 *     // Extract information from request
 *     console.log('Service received request payload: ' + request.payload)
 *     // Create the response message
 *     var response = new dxl.Response(request)
 *     // Populate the response payload
 *     response.payload = 'pong'
 *     // Send the response
 *     client.sendResponse(response)
 *   })
 * // Register the service with the fabric
 * client.registerServiceAsync(info,
 *   function (error) {
 *     // If an error did not occur, invoke the service (send a request)
 *     if (!error) {
 *       // Create the request message
 *       var request = new dxl.Request(SERVICE_TOPIC)
 *       // Populate the request payload
 *       request.payload = 'ping'
 *       // Send the request
 *       client.asyncRequest(request,
 *         // Handle the response to the request
 *         function (error, response) {
 *           // Destroy the client - frees up resources so that the
 *           // application stops running
 *           client.destroy()
 *           // Extract information from the response (if an error did not
 *           // occur)
 *           if (!error) {
 *             console.log('Client received response payload: ' +
 *               response.payload)
 *           }
 *         })
 *     }
 *   })
 * @param {Client} client - The {@link Client} instance that will expose this
 *   service.
 * @param {String} serviceType - A textual name for the service. For example,
 *   "/mycompany/myservice".
 * @constructor
 */
function ServiceRegistrationInfo (client, serviceType) {
  /**
   * Object which maps topic keys to an array of callback functions. The
   * callback functions are invoked for incoming {@link Request} messages
   * made for the topic.
   * @type {Object}
   * @default ''
   * @name ServiceRegistrationInfo#_callbacksByTopic
   * @private
   */
  this._callbacksByTopic = {}
  /**
   * A textual name for the service. For example, "/mycompany/myservice".
   * @type {String}
   * @name ServiceRegistrationInfo#serviceType
   */
  this.serviceType = serviceType
  /**
   * The set of tenant identifiers that the service will be available to.
   * Setting this value will limit which tenants can invoke the service.
   * @type {Array<String>}
   * @default []
   * @name ServiceRegistrationInfo#destinationTenantGuids
   */
  this.destinationTenantGuids = []
  /**
   * An object of name-value pairs that are sent as part of the service
   * registration. Brokers provide a registry service that allows for
   * registered services and their associated meta-information to be inspected.
   * The metadata is typically used to include information such as the versions
   * for products that are exposing DXL services, etc.
   * @type {Object}
   * @default {}
   * @name ServiceRegistrationInfo#metadata
   */
  this.metadata = {}
  /**
   * A unique identifier for the service instance (automatically generated when
   * the {@link ServiceRegistrationInfo} object is constructed).
   * @type {String}
   * @name ServiceRegistrationInfo#serviceId
   */
  this.serviceId = util.generateIdAsString()
  /**
   * The interval (in minutes) at which the client will automatically
   * re-register the service with the DXL fabric.
   * @type {Number}
   * @default 60
   * @name ServiceRegistrationInfo#ttl
   */
  this.ttl = DEFAULT_TTL
}

/**
 Registers a topic for the service to respond to along with the request
 callback that will be invoked.
 * @param {String} topic - The topic for the service to respond to.
 * @param {Function} callback - The request callback that will be invoked when
 *   a {@link Request} message is received. The {@link Request} object is
 *   supplied as the only parameter to the request callback function.
 */
ServiceRegistrationInfo.prototype.addTopic = function (topic, callback) {
  let callbacks = this._callbacksByTopic[topic]
  if (!callbacks) {
    callbacks = []
    this._callbacksByTopic[topic] = callbacks
  }

  callbacks.push(callback)
}

/**
 * Registers a set of topics for the service to respond to along with their
 * associated request callbacks.
 * @param {Object} callbacksByTopic - Object containing a set of topics for the
 *   service to respond to along with their associated request callback
 *   instances. Each key in the object should have a string representation of
 *   the topic name. Each corresponding value in the object should contain the
 *   function to be invoked when a {@link Request} message is received. The
 *   {@link Request} object is supplied as the only parameter to the request
 *   callback function.
 */
ServiceRegistrationInfo.prototype.addTopics = function (callbacksByTopic) {
  const that = this
  if (typeof callbacksByTopic !== 'object') {
    throw new TypeError('callbacksByTopic must be an object')
  }
  Object.keys(callbacksByTopic).forEach(function (topic) {
    that.addTopic(topic, callbacksByTopic[topic])
  })
}

/**
 * @property {Array<String>} - An array containing the string name of each
 *   topic that the service responds to.
 * @name ServiceRegistrationInfo#topics
 */
Object.defineProperty(ServiceRegistrationInfo.prototype, 'topics', {
  get: function () { return Object.keys(this._callbacksByTopic) }
})

/**
 * Returns an array of functions which should be called upon receipt of a
 * {@link Request} with the supplied topic.
 * @param {String} topic - Topic for which to return associated callback
 *   functions.
 * @returns {Array<Function>} Array of callback functions for the topic.
 */
ServiceRegistrationInfo.prototype.callbacks = function (topic) {
  const callbacks = this._callbacksByTopic[topic]
  return (typeof callbacks === 'undefined') ? [] : callbacks
}

module.exports = ServiceRegistrationInfo
