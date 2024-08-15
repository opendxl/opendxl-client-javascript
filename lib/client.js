'use strict'

const events = require('events')
const inherits = require('inherits')
const mqtt = require('mqtt')

const CallbackManager = require('./callback-manager')
const decodeMessage = require('./decode-message')
const DxlError = require('./dxl-error')
const message = require('./message')
const RequestManager = require('./request-manager')
const ServiceManager = require('./service-manager')
const HttpsProxyAgent = require('https-proxy-agent')
const { URL } = require('url')
const nodeUtil = require('util')
const debug = nodeUtil.debuglog('dxlclient')

const REPLY_TO_PREFIX = '/mcafee/client/'

/**
 * @classdesc Responsible for all communication with the
 * Data Exchange Layer (DXL) fabric. (It can be thought of as the 'main'
 * class). All other classes exist to support the functionality provided by
 * the client.
 * @example
 * var dxl = require('@opendxl/dxl-client')
 * var fs = require('fs')
 * var config = new dxl.Config(
 *   fs.readFileSync('c:\\certs\\brokercerts.crt'),
 *   fs.readFileSync('c:\\certs\\client.crt'),
 *   fs.readFileSync('c:\\certs\\client.key'),
 *   [dxl.Broker.parse('ssl://192.168.99.100')])
 *
 * var client = new dxl.Client(config)
 * client.connect()
 * @param {Config} config - Object containing the configuration settings for
 *   the client
 * @constructor
 */
function Client (config) {
  /**
   * The {@link Config} instance that was specified when the client was
   * constructed.
   * @type {Config}
   * @name Client#config
   */
  this.config = config
  /**
   * The client id derived from the client configuration.
   * @private
   * @type {String}
   * @name Client#_clientId
   */
  this._clientId = config._clientId
  /**
   * Information for the last broker to which the client connected.
   * @private
   * @type {Broker}
   * @name Client#_lastConnectedBroker
   */
  this._lastConnectedBroker = null
  /**
   * Prefix of the topic that the broker will reply to for request messages.
   * @private
   * @type {string}
   * @name Client#_replyToTopic
   */
  this._replyToTopic = REPLY_TO_PREFIX + this._clientId
  /**
   * Handle to the underlying MQTT client object
   * @private
   * @type {MqttClient}
   * @name Client#_mqttClient
   */
  this._mqttClient = null
  /**
   * Mapping of registered subscriptions. Each key in the object represents
   * a topic string. Each value in the object is an object with keys
   * representing one of the type constants in the {@link Message} class - for
   * example, {@link Message.MESSAGE_TYPE_RESPONSE}, and values being an array
   * of callback functions.
   * @private
   * @example
   * var this._subscriptionsByMessageType = {}
   * var callbacksForTopic = {}
   * callbacksForTopic[Message.MESSAGE_TYPE_RESPONSE] =
   *   function(message) { console.log('my callback') }
   * this._subscriptionsByMessageType['/topic1'] = callbacksForTopic
   * @name Client#_callbacksByMessageType
   * @default {}
   * @type {Object}
   * @name Client#_subscriptionsByMessageType
   */
  this._subscriptionsByMessageType = {}
  /**
   * Handle to a manager of message callbacks registered with the client.
   * @private
   * @type {CallbackManager}
   * @name Client#_callbackManager
   */
  this._callbackManager = new CallbackManager()
  /**
   * Handle to a manager of requests made to a broker.
   * @private
   * @type {RequestManager}
   * @name Client#_requestManager
   */
  this._requestManager = new RequestManager(this, this._replyToTopic)
  /**
   * Handle to a manager of services registered with the broker.
   * @private
   * @type {ServiceManager}
   * @name Client#_serviceManager
   */
  this._serviceManager = new ServiceManager(this)
  /**
   * Unique host/port combinations distilled from the brokers in the client
   * configuration. See {@link Config#brokers}. This array of broker
   * information is passed along to the MQTT client to establish a connection.
   * @private
   * @example
   * var this._servers = [ { host: 'host1', port: 8883 },
   *                       { host: 'host2', port: 8993 } ]
   * @type {Array<Object>}
   * @name Client#_servers
   */
  this._servers = this.config.brokers.reduce(function (result, broker) {
    broker.hosts.forEach(function (host) {
      if (!result.some(function (hostPortEntry) {
        return (host === hostPortEntry.host) &&
          (broker.port === hostPortEntry.port)
      })) {
        result.push({ host, port: broker.port })
      }
    })
    return result
  }, [])

  this._iswebSocketEnabled = this.config.useWebSockets
  events.EventEmitter.call(this)
}

inherits(Client, events.EventEmitter)

/**
 * @property {Boolean} - Whether or not the client is currently connected to
 *   the DXL fabric.
 * @name Client#connected
 */
Object.defineProperty(Client.prototype, 'connected', {
  get: function () {
    return this._mqttClient ? this._mqttClient.connected : false
  }
})

/**
 * @property {Broker} - Broker that the client is currently connected to.
 *   _null_ is returned if the client is not currently connected to a broker.
 * @name Client#currentBroker
 */
Object.defineProperty(Client.prototype, 'currentBroker', {
  get: function () {
    return this.connected ? this._lastConnectedBroker : null
  }
})

const EXPLICIT_SUBSCRIPTION_MESSAGE_TYPE = ''
function explicitSubscriptionCallback () {}

/**
 * Add a topic subscription.
 * @private
 * @param {Client} client - The {@link Client} instance to which the topic
 *   subscription should be added.
 * @param {String} topic - Topic to subscribe to. An empty string or null value
 *   indicates that the callback should receive messages for all topics
 *   (no filtering).
 * @param {(Number|String)} messageType - Type of DXL messages for which the
 *   callback should be invoked. Corresponds to one of the message type
 *   constants in the {@link Message} class - for example,
 *   {@link Message.MESSAGE_TYPE_RESPONSE}.
 * @param {Function} callback - Callback function which should be invoked
 *   for a matching message. The first argument passed to the callback
 *   function is the DXL Message object.
 * @param {Boolean} [subscribeToTopic=true] - Whether or not to subscribe for
 *   the topic with the broker.
 */
function addSubscription (client, topic, messageType,
  callback, subscribeToTopic) {
  if (typeof (subscribeToTopic) === 'undefined') { subscribeToTopic = true }

  if (callback !== explicitSubscriptionCallback) {
    client._callbackManager.addCallback(messageType, topic, callback)
  }

  if (subscribeToTopic && topic) {
    let topicMessageTypes = client._subscriptionsByMessageType[topic]
    // Only subscribe for the topic with the broker if no prior
    // subscription has been established
    if (!topicMessageTypes) {
      if (client._mqttClient) {
        client._mqttClient.subscribe(topic)
      }
      topicMessageTypes = {}
      client._subscriptionsByMessageType[topic] = topicMessageTypes
    }

    const messageTypeCallbacks = topicMessageTypes[messageType]
    if (messageTypeCallbacks) {
      if (messageTypeCallbacks.indexOf(callback) < 0) {
        messageTypeCallbacks.push(callback)
      }
    } else {
      topicMessageTypes[messageType] = [callback]
    }
  }
}

/**
 * Removes a topic subscription.
 * @private
 * @param {Client} client - The {@link Client} instance from which the topic
 *   subscription should be removed.
 * @param {String} topic - Topic to unsubscribe from.
 * @param {(Number|String)} messageType - Type of DXL messages for which the
 *   callback should be invoked. Corresponds to one of the message type
 *   constants in the {@link Message} class - for example,
 *   {@link Message.MESSAGE_TYPE_RESPONSE}.
 * @param {Function} callback - Callback function which should be invoked
 *   for a matching message.
 */
function removeSubscription (client, topic, messageType, callback) {
  if (callback !== explicitSubscriptionCallback) {
    client._callbackManager.removeCallback(messageType, topic, callback)
  }

  if (topic) {
    const subscriptionsByMessageType = client._subscriptionsByMessageType
    const topicMessageTypes = subscriptionsByMessageType[topic]
    if (topicMessageTypes) {
      // If a call to the client's unsubscribe() function for the topic
      // was made, unsubscribe regardless of any other active
      // callback-based subscriptions
      if (callback === explicitSubscriptionCallback) {
        delete subscriptionsByMessageType[topic]
      } else {
        const messageTypeCallbacks = topicMessageTypes[messageType]
        if (messageTypeCallbacks) {
          const callbackPosition = messageTypeCallbacks.indexOf(callback)
          if (callbackPosition > -1) {
            if (messageTypeCallbacks.length > 1) {
              // Remove the callback from the list of subscribers
              // for the topic and associated message type
              messageTypeCallbacks.splice(callbackPosition, 1)
            } else {
              if (Object.keys(topicMessageTypes).length > 1) {
                // Remove the message type entry since no more callbacks
                // are registered for the topic
                delete topicMessageTypes[messageType]
              } else {
                // Remove the topic entry since no more message types are
                // registered for it
                delete subscriptionsByMessageType[topic]
              }
            }
          }
        }
      }
      if (client._mqttClient && !subscriptionsByMessageType[topic]) {
        client._mqttClient.unsubscribe(topic)
      }
    }
  }
}

/**
 * Publishes data to a specific topic.
 * @private
 * @param {Client} client - The {@link Client} instance to which the message
 *   should be published.
 * @param {String} topic - Topic to publish message to.
 * @param {(String|Buffer)} message - Message to publish.
 * @throws {DxlError} If the MQTT client is not connected.
 */
function publish (client, topic, message) {
  if (client._mqttClient) {
    client._mqttClient.publish(topic, message)
  } else {
    throw new DxlError(
      'Client not connected, unable to publish data to: ' + topic)
  }
}

/**
 * Attempts to connect the client to the DXL fabric. This method returns
 * immediately if a broker has been configured to connect to. The connection
 * is established asynchronously. If provided, the callback function will
 * be invoked the first time a connection has been established to the broker.
 * @param {Function} [callback=null] - Callback function to invoke when
 *   the connection is first established. No arguments are passed to the
 *   callback.
 * @throws {DxlError} If no brokers have been specified in the Config passed
 *   to the client constructor.
 */
Client.prototype.connect = function (callback) {
  if (!this._servers.length) {
    throw new DxlError(
      'Unable to connect: no brokers specified in the client configuration')
  }
  const that = this
  let firstConnection = true
  // server list
  const brokerList = this._servers
  // default protocol is MQTT
  let protocolToUse = 'mqtts'
  let rejectUnauthorized = true
  // if UseWebSockets property is enabled or mqtt broker list is empty, connect via WebSockets
  if (this._iswebSocketEnabled) {
    protocolToUse = 'wss'
    rejectUnauthorized = false
    console.log('Setting \'UseWebSockets\' is enabled. Client will connect via WebSockets')
  }
  const connectOptions = {
    servers: brokerList,
    protocol: protocolToUse,
    protocolId: 'MQIsdp',
    protocolVersion: 3,
    clientId: this._clientId,
    key: this.config.privateKey,
    cert: this.config.cert,
    ca: this.config.brokerCaBundle,
    checkServerIdentity: function () {
      return undefined
    },
    keepalive: this.config.keepAliveInterval,
    reconnectPeriod: this.config.reconnectDelay * 1000,
    rejectUnauthorized,
    requestCert: true
  }
  // check proxy configuration (Optional)
  const proxy = that.config.proxy
  if (protocolToUse === 'wss' && proxy) {
    const port = proxy.port
    const hostname = proxy.address
    const user = proxy.user
    const pwd = proxy.password
    // http proxy support Only
    const proxyUrl = `http://${hostname}:${port}`
    const proxyOptions = new URL(proxyUrl)
    // true for wss
    proxyOptions.secureEndpoint = true
    console.log('Connecting via Proxy:', proxyUrl)
    if (user && pwd) {
      proxyOptions.username = user
      proxyOptions.password = pwd
      console.log('Proxy connection user:', user)
    }
    // Set up a proxy agent
    const wsagent = new HttpsProxyAgent(proxyOptions)
    // Set Agent for wsOption in MQTT
    connectOptions.wsOptions = {
      agent: wsagent
    }
  }

  debug('Connect options', connectOptions)
  const mqttClient = mqtt.connect(connectOptions)

  Object.keys(this._subscriptionsByMessageType).forEach(function (topic) {
    mqttClient.subscribe(topic)
  })

  mqttClient.on('connect', function () {
    that._lastConnectedBroker = null

    if (connectOptions.host && connectOptions.port) {
      console.log('Connected to: ' + connectOptions.host + ':' +
        connectOptions.port)

      for (let index = 0; index < that.config.brokers.length; index++) {
        const broker = that.config.brokers[index]
        if ((broker.hosts.indexOf(connectOptions.host) > -1) &&
          (broker.port === connectOptions.port)) {
          that._lastConnectedBroker = broker
          break
        }
      }
    } else {
      console.log('Connected')
    }

    that._serviceManager.onConnected()
    if (typeof (callback) !== 'undefined' && callback && firstConnection) {
      firstConnection = false
      callback()
    }
    that.emit('connect')
  })

  mqttClient.on('close', function () {
    that.emit('close')
  })

  mqttClient.on('error', function (error) {
    console.log(error.toString())
    // Avoid emitting MQTT client errors if there are no registered listeners.
    // Otherwise, the error would be unhandled and could, in Node.js, shut
    // down the hosting process.
    if (that.listenerCount('error') > 0) {
      that.emit('error', error)
    }
  })

  mqttClient.on('message', function (topic, rawMessage) {
    try {
      const message = decodeMessage(rawMessage)
      message.destinationTopic = topic
      that._callbackManager.onMessage(message)
    } catch (err) {
      console.log('Failed to process incoming message: ' + err)
    }
  })

  mqttClient.on('packetreceive', function (packet) {
    that.emit('packetreceive', packet)
  })

  mqttClient.on('packetsend', function (packet) {
    that.emit('packetsend', packet)
  })

  mqttClient.on('reconnect', function () {
    that.emit('reconnect')
  })

  this._mqttClient = mqttClient
}

/**
 * Adds an event callback to the client for the specified topic. The callback
 * will be invoked when {@link Event} messages are received by the client on
 * the specified topic.
 * @param {String} topic - Topic to receive {@link Event} messages on. An empty
 *   string or null value indicates that the callback should receive messages
 *   for all topics (no filtering).
 * @param {Function} eventCallback - Callback function which should be invoked
 *   for a matching message. The first argument passed to the callback
 *   function is the {@link Event} object.
 * @param {Boolean} [subscribeToTopic=true] - Whether or not to subscribe for
 *   the topic with the broker.
 */
Client.prototype.addEventCallback = function (topic,
  eventCallback,
  subscribeToTopic) {
  addSubscription(this, topic, message.MESSAGE_TYPE_EVENT, eventCallback,
    subscribeToTopic)
}

/**
 * Removes an event callback from the client for the specified topic. This
 * method must be invoked with the same arguments as when the callback was
 * originally registered via {@link Client#addEventCallback}.
 * @param {String} topic - The topic to remove the callback for.
 * @param {Function} eventCallback - The event callback to be removed for the
 *   specified topic.
 */
Client.prototype.removeEventCallback = function (topic, eventCallback) {
  removeSubscription(this, topic, message.MESSAGE_TYPE_EVENT,
    eventCallback)
}

/**
 * Adds a request callback to the client for the specified topic. The callback
 * will be invoked when {@link Request} messages are received by the client on
 * the specified topic. Note that usage of this is quite rare due to the fact
 * that registration of instances with the client occurs automatically when
 * registering a service.
 * @param {String} topic - Topic to receive {@link Request} messages on. A
 *   empty string or null value indicates that the callback should receive
 *   messages for all topics (no filtering).
 * @param {Function} requestCallback - Callback function which should be
 *   invoked for a matching message. The first argument passed to the callback
 *   function is the {@link Request} object.
 * @param {Boolean} [subscribeToTopic=true] - Whether or not to subscribe for
 *   the topic with the broker.
 */
Client.prototype.addRequestCallback = function (topic,
  requestCallback,
  subscribeToTopic) {
  addSubscription(this, topic, message.MESSAGE_TYPE_REQUEST,
    requestCallback, subscribeToTopic)
}

/**
 * Removes a request callback from the client for the specified topic. This
 * method must be invoked with the same arguments as when the callback was
 * originally registered via {@link Client#addRequestCallback}.
 * @param {String} topic - The topic to remove the callback for.
 * @param {Function} requestCallback - The request callback to be removed for
 *   the specified topic.
 */
Client.prototype.removeRequestCallback = function (topic, requestCallback) {
  removeSubscription(this, topic, message.MESSAGE_TYPE_REQUEST,
    requestCallback)
}

/**
 * Adds a response callback to the client for the specified topic. The callback
 * will be invoked when {@link Response} messages are received by the client on
 * the specified topic. Note that usage of this is quite rare due to the fact
 * that the use of response callbacks are typically limited to invoking a
 * remote DXL service via the {@link Client#asyncRequest} method.
 * @param {String} topic - Topic to receive {@link Response} messages on. A
 *   empty string or null value indicates that the callback should receive
 *   messages for all topics (no filtering).
 * @param {Function} responseCallback - Callback function which should be
 *   invoked for a matching message. The first argument passed to the callback
 *   function is the {@link Request} object.
 * @param {Boolean} [subscribeToTopic=true] - Whether or not to subscribe for
 *   the topic with the broker.
 */
Client.prototype.addResponseCallback = function (topic,
  responseCallback,
  subscribeToTopic) {
  addSubscription(this, topic, message.MESSAGE_TYPE_RESPONSE,
    responseCallback, subscribeToTopic)
  addSubscription(this, topic, message.MESSAGE_TYPE_ERROR,
    responseCallback, subscribeToTopic)
}

/**
 * Removes a response callback from the client for the specified topic. This
 * method must be invoked with the same arguments as when the callback was
 * originally registered via {@link Client#addResponseCallback}.
 * @param {String} topic - The topic to remove the callback for.
 * @param {Function} responseCallback - The response callback to be removed for
 *   the specified topic.
 */
Client.prototype.removeResponseCallback = function (topic,
  responseCallback) {
  removeSubscription(this, topic, message.MESSAGE_TYPE_RESPONSE,
    responseCallback)
  removeSubscription(this, topic, message.MESSAGE_TYPE_ERROR,
    responseCallback)
}

/**
 * Subscribes to the specified topic on the DXL fabric. This method is
 * typically used in conjunction with the registration of event callbacks
 * via the {@link Client#addEventCallback} method.
 *
 * **NOTE:** By default when registering an event callback the client will
 * automatically subscribe to the topic. In the example below, the
 * {@link Client#addEventCallback} method is invoked with the
 * _subscribeToTopic_ parameter set to false, preventing the automatic
 * subscription.
 * @example
 * client.addEventCallback('/testeventtopic',
 *   function (event) {
 *     console.log('Received event! ' + event.sourceClientId)
 *   }, false)
 * client.subscribe('/testeventtopic')
 * @param {String} topic - The topic to subscribe to
 */
Client.prototype.subscribe = function (topic) {
  addSubscription(this, topic, EXPLICIT_SUBSCRIPTION_MESSAGE_TYPE,
    explicitSubscriptionCallback)
}

/**
 * Unsubscribes from the specified topic on the DXL fabric. See the
 * {@link Client#subscribe} method for more information on subscriptions.
 * @param {String} topic - The topic to unsubscribe from.
 */
Client.prototype.unsubscribe = function (topic) {
  removeSubscription(this, topic, EXPLICIT_SUBSCRIPTION_MESSAGE_TYPE,
    explicitSubscriptionCallback)
}

/**
 * @property {Array<String>} - An array containing the topics that the client
 *   is currently subscribed to. See {@link Client#subscribe} for more
 *   information on adding subscriptions.
 * @name Client#subscriptions
 */
Object.defineProperty(Client.prototype, 'subscriptions', {
  get: function () { return Object.keys(this._subscriptionsByMessageType) }
})

/**
 * Sends a {@link Request} message to a remote DXL service asynchronously. An
 * optional response callback can be specified. This callback will be invoked
 * when the corresponding {@link Response} message (or an error) is received by
 * the client.
 * @param {Request} request - The request message to send to a remote DXL
 *   service.
 * @param {Function} [responseCallback] - An optional response callback
 *   that will be invoked with the result of the request.
 *
 *   If an error occurs during the request, the first parameter supplied to the
 *   callback contains an {@link Error} with failure details. If the response
 *   from the DXL fabric to the request includes an {@link ErrorResponse}, the
 *   first parameter is a {@link RequestError} (which contains the error
 *   response in its {@link RequestError#dxlErrorResponse} property).
 *
 *   If the request is successful, the second parameter includes a
 *   {@link Response} message.
 * @throws {DxlError} If no prior attempt has been made to connect the client
 *   via a call to {@link Client#connect}.
 */
Client.prototype.asyncRequest = function (request, responseCallback) {
  this._requestManager.asyncRequest(request, responseCallback)
}

/**
 * Attempts to deliver the specified {@link Event} message to the DXL fabric.
 * See {@link Message} for more information on message types, how they are
 * delivered to remote clients, etc.
 * @param {Event} event - The {@link Event} to send.
 * @throws {DxlError} If no prior attempt has been made to connect the client
 *   via a call to {@link Client#connect}.
 */
Client.prototype.sendEvent = function (event) {
  publish(this, event.destinationTopic, event._toBytes())
}

/**
 * Attempts to deliver the specified {@link Response} message to the DXL
 * fabric. The fabric will in turn attempt to deliver the response back to the
 * client who sent the corresponding {@link Request}.
 * @param {Response} response - The {@link Response} to send.
 * @throws {DxlError} If no prior attempt has been made to connect the client
 *   via a call to {@link Client#connect}.
 */
Client.prototype.sendResponse = function (response) {
  publish(this, response.destinationTopic, response._toBytes())
}

/**
 * Registers a DXL service with the fabric asynchronously. The specified
 * {@link ServiceRegistrationInfo} instance contains information about the
 * service that is to be registered.
 * @param {ServiceRegistrationInfo} serviceRegInfo - A
 *   {@link ServiceRegistrationInfo} instance containing information about the
 *   service that is to be registered.
 * @param {Function} [callback=null] - An optional callback that will be
 *   invoked when the registration attempt is complete. If an error occurs
 *   during the registration attempt, the first parameter supplied to the
 *   callback contains an {@link Error} with failure details.
 */
Client.prototype.registerServiceAsync = function (serviceRegInfo, callback) {
  this._serviceManager.registerServiceAsync(serviceRegInfo, callback)
}

/**
 * Unregisters (removes) a DXL service from the fabric asynchronously. The
 * specified {@link ServiceRegistrationInfo} instance contains information
 * about the service that is to be removed.
 * @param {ServiceRegistrationInfo} serviceRegInfo - A
 *   {@link ServiceRegistrationInfo} instance containing information about the
 *   service that is to be unregistered.
 * @param {Function} [callback=null] - An optional callback that will be
 *   invoked when the unregistration attempt is complete. If an error occurs
 *   during the unregistration attempt, the first parameter supplied to the
 *   callback contains an {@link Error} with failure details.
 */
Client.prototype.unregisterServiceAsync = function (serviceRegInfo, callback) {
  this._serviceManager.unregisterServiceAsync(serviceRegInfo, callback)
}

/**
 * Attempts to disconnect the client from the DXL fabric.
 * @param {Function} [callback=null] - An optional callback that will be
 *   invoked when the disconnection attempt is complete. No arguments are
 *   passed to the callback.
 */
Client.prototype.disconnect = function (callback) {
  let invokeCallback = (typeof (callback) !== 'undefined')
  if (this._mqttClient) {
    // If the client is already disconnected, avoid waiting for any in-flight
    // messages to be acked before proceeding with the shutdown of client
    // resources. These messages would not be acked anyway - since no connection
    // exists to deliver the acks. Waiting for acks when the client is already
    // disconnected could cause resources to never be freed - and a callback to
    // not be invoked.
    const doNotWaitForAcksOnInFlightMessages = !this.connected
    // The underlying MQTT client only invokes a callback given to it if
    // it isn't already in the process of disconnecting. The logic below
    // ensures that the callback is only invoked once.
    if (this._mqttClient.disconnecting) {
      this._mqttClient.end(doNotWaitForAcksOnInFlightMessages)
    } else {
      invokeCallback = false
      this._mqttClient.end(doNotWaitForAcksOnInFlightMessages, callback)
    }
  }
  if (invokeCallback) {
    callback()
  }
}

/**
 * Destroys the client (releases all associated resources).
 *
 * **NOTE:** Once the method has been invoked, no other calls should be made to
 * the client.
 *
 * @param {Function} [callback=null] - An optional callback that will be
 *   invoked after client resources have been destroyed. No arguments are
 *   passed to the callback.
 */
Client.prototype.destroy = function (callback) {
  this._serviceManager.destroy()
  if (this._mqttClient) {
    const topics = Object.keys(this._subscriptionsByMessageType)
    if (topics.length) {
      this._mqttClient.unsubscribe(topics)
    }
  }
  this.disconnect(callback)
  this._subscriptionsByMessageType = {}
  this._callbackManager.destroy()
}

/**
 * Sends a request.
 * @private
 * @param {Request} request - The {@link Request} to send.
 * @private
 */
Client.prototype._sendRequest = function (request) {
  request.replyToTopic = this._replyToTopic
  publish(this, request.destinationTopic, request._toBytes())
}

module.exports = Client
