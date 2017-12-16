'use strict'

var mqtt = require('mqtt')

var CallbackManager = require('./_callback_manager')
var decodeMessage = require('./_decode_message')
var error = require('./error')
var message = require('./message')
var RequestManager = require('./_request_manager')
var ServiceManager = require('./_service_manager')

var REPLY_TO_PREFIX = '/mcafee/client/'

function DxlClient (config) {
  this._config = config
  this._clientId = config._clientId
  this._lastConnectedBroker = null
  this._replyToTopic = REPLY_TO_PREFIX + this._clientId
  this._mqttClient = null
  this._subscriptionsByMessageType = {}

  this._callbackManager = new CallbackManager(this)
  this._requestManager = new RequestManager(this, this._replyToTopic)
  this._serviceManager = new ServiceManager(this)

  // Add unique host port combinations from the available brokers to the
  // array of servers to be used for a client connection
  this._servers = this._config.brokers.reduce(function (result, broker) {
    broker.hosts.forEach(function (host) {
      if (!result.some(function (hostPortEntry) {
        return (host === hostPortEntry.host) &&
          (broker.port === hostPortEntry.port)
      })) {
        result.push({host: host, port: broker.port})
      }
    })
    return result
  }, [])
}

Object.defineProperty(DxlClient.prototype, 'connected', {
  get: function () {
    return this._mqttClient ? this._mqttClient.connected : false
  }
})

Object.defineProperty(DxlClient.prototype, 'currentBroker', {
  get: function () {
    return this.connected ? this._lastConnectedBroker : null
  }
})

var EXPLICIT_SUBSCRIPTION_MESSAGE_TYPE = ''
function explicitSubscriptionCallback () {}

function addSubscription (topic, messageType, callback, subscribeToTopic) {
  // jshint validthis: true
  if (typeof (subscribeToTopic) === 'undefined') { subscribeToTopic = true }

  if (callback !== explicitSubscriptionCallback) {
    this._callbackManager.addCallback(messageType, topic, callback)
  }

  if (subscribeToTopic && topic) {
    var topicMessageTypes = this._subscriptionsByMessageType[topic]
    // Only subscribe for the topic with the broker if no prior
    // subscription has been established
    if (!topicMessageTypes) {
      if (this._mqttClient) {
        this._mqttClient.subscribe(topic)
      }
      topicMessageTypes = {}
      this._subscriptionsByMessageType[topic] = topicMessageTypes
    }

    var messageTypeCallbacks = topicMessageTypes[messageType]
    if (messageTypeCallbacks) {
      if (messageTypeCallbacks.indexOf(callback) < 0) {
        messageTypeCallbacks.push(callback)
      }
    } else {
      topicMessageTypes[messageType] = [callback]
    }
  }
}

function removeSubscription (topic, messageType, callback) {
  // jshint validthis: true
  if (callback !== explicitSubscriptionCallback) {
    this._callbackManager.removeCallback(messageType, topic, callback)
  }

  if (topic) {
    var subscriptionsByMessageType = this._subscriptionsByMessageType
    var topicMessageTypes = subscriptionsByMessageType[topic]
    if (topicMessageTypes) {
      // If a call to the client's unsubscribe() function for the topic
      // was made, unsubscribe regardless of any other active
      // callback-based subscriptions
      if (callback === explicitSubscriptionCallback) {
        delete subscriptionsByMessageType[topic]
      } else {
        var messageTypeCallbacks = topicMessageTypes[messageType]
        if (messageTypeCallbacks) {
          var callbackPosition = messageTypeCallbacks.indexOf(callback)
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
      if (this._mqttClient && !subscriptionsByMessageType[topic]) {
        this._mqttClient.unsubscribe(topic)
      }
    }
  }
}

function publish (topic, data) {
  // jshint validthis: true
  if (this._mqttClient) {
    this._mqttClient.publish(topic, data)
  } else {
    throw new error.DxlError(
      'Client not connected, unable to publish data to: ' + topic)
  }
}

DxlClient.prototype.connect = function (callback) {
  var that = this
  var firstConnection = true

  var connectOptions = {
    servers: this._servers,
    protocol: 'mqtts',
    protocolId: 'MQIsdp',
    protocolVersion: 3,
    clientId: this._clientId,
    key: this._config.privateKey,
    cert: this._config.cert,
    ca: this._config.brokerCaBundle,
    checkServerIdentity: function () {
      return undefined
    },
    keepalive: this._config.keepAliveInterval,
    reconnectPeriod: this._config.reconnectDelay * 1000,
    rejectUnauthorized: true,
    requestCert: true
  }

  var mqttClient = mqtt.connect(connectOptions)

  Object.keys(this._subscriptionsByMessageType).forEach(function (topic) {
    mqttClient.subscribe(topic)
  })

  mqttClient.on('connect', function () {
    that._lastConnectedBroker = null

    if (connectOptions.host && connectOptions.port) {
      console.log('Connected to: ' + connectOptions.host + ':' +
        connectOptions.port)

      for (var index = 0; index < that._config.brokers.length; index++) {
        var broker = that._config.brokers[index]
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
  })

  mqttClient.on('message', function (topic, rawMessage) {
    var message = decodeMessage(rawMessage)
    message.destinationTopic = topic
    that._callbackManager.onMessage(message)
  })

  mqttClient.on('error', function (error) {
    console.log(error.toString())
  })

  this._mqttClient = mqttClient
}

DxlClient.prototype.addEventCallback = function (topic,
                                                 eventCallback,
                                                 subscribeToTopic) {
  addSubscription.call(this, topic, message.MESSAGE_TYPE_EVENT, eventCallback,
    subscribeToTopic)
}

DxlClient.prototype.removeEventCallback = function (topic, eventCallback) {
  removeSubscription.call(this, topic, message.MESSAGE_TYPE_EVENT,
    eventCallback)
}

DxlClient.prototype.addRequestCallback = function (topic,
                                                   requestCallback,
                                                   subscribeToTopic) {
  addSubscription.call(this, topic, message.MESSAGE_TYPE_REQUEST,
    requestCallback, subscribeToTopic)
}

DxlClient.prototype.removeRequestCallback = function (topic, requestCallback) {
  removeSubscription.call(this, topic, message.MESSAGE_TYPE_REQUEST,
    requestCallback)
}

DxlClient.prototype.addResponseCallback = function (topic,
                                                    responseCallback,
                                                    subscribeToTopic) {
  addSubscription.call(this, topic, message.MESSAGE_TYPE_RESPONSE,
    responseCallback, subscribeToTopic)
  addSubscription.call(this, topic, message.MESSAGE_TYPE_ERROR,
    responseCallback, subscribeToTopic)
}

DxlClient.prototype.removeResponseCallback = function (topic,
                                                       responseCallback) {
  removeSubscription.call(this, topic, message.MESSAGE_TYPE_RESPONSE,
    responseCallback)
  removeSubscription.call(this, topic, message.MESSAGE_TYPE_ERROR,
    responseCallback)
}

DxlClient.prototype.subscribe = function (topic) {
  addSubscription.call(this, topic, EXPLICIT_SUBSCRIPTION_MESSAGE_TYPE,
    explicitSubscriptionCallback)
}

DxlClient.prototype.unsubscribe = function (topic) {
  removeSubscription.call(this, topic, EXPLICIT_SUBSCRIPTION_MESSAGE_TYPE,
    explicitSubscriptionCallback)
}

Object.defineProperty(DxlClient.prototype, 'subscriptions', {
  get: function () { return Object.keys(this._subscriptionsByMessageType) }
})

DxlClient.prototype.asyncRequest = function (request, responseCallback) {
  this._requestManager.asyncRequest(request, responseCallback)
}

DxlClient.prototype.sendEvent = function (event) {
  publish.call(this, event.destinationTopic, event._toBytes())
}

DxlClient.prototype.sendResponse = function (response) {
  publish.call(this, response.destinationTopic, response._toBytes())
}

DxlClient.prototype.registerServiceAsync = function (serviceRegInfo,
                                                     registrationCallback) {
  this._serviceManager.registerServiceAsync(serviceRegInfo,
    registrationCallback)
}

DxlClient.prototype.unregisterServiceAsync = function (
  serviceRegInfo, unregistrationCallback) {
  this._serviceManager.unregisterServiceAsync(serviceRegInfo,
    unregistrationCallback)
}

DxlClient.prototype.disconnect = function () {
  if (this._mqttClient) {
    this._mqttClient.end()
  }
}

DxlClient.prototype.destroy = function () {
  this._serviceManager.destroy()
  if (this._mqttClient) {
    var topics = Object.keys(this._subscriptionsByMessageType)
    if (topics.length) {
      this._mqttClient.unsubscribe(topics)
    }
  }
  this.disconnect()
  this._subscriptionsByMessageType = {}
  this._callbackManager.destroy()
}

DxlClient.prototype._sendRequest = function (request) {
  request.replyToTopic = this._replyToTopic
  publish.call(this, request.destinationTopic, request._toBytes())
}

module.exports = DxlClient
