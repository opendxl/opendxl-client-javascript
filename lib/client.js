'use strict'

var events = require('events')
var inherits = require('inherits')
var mqtt = require('mqtt')

var CallbackManager = require('./callback_manager')
var decodeMessage = require('./decode_message')
var DxlError = require('./dxl_error')
var message = require('./message')
var RequestManager = require('./request_manager')
var ServiceManager = require('./service_manager')

var REPLY_TO_PREFIX = '/mcafee/client/'

function Client (config) {
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

  events.EventEmitter.call(this)
  this.on('error', function () {})
}

inherits(Client, events.EventEmitter)

Object.defineProperty(Client.prototype, 'connected', {
  get: function () {
    return this._mqttClient ? this._mqttClient.connected : false
  }
})

Object.defineProperty(Client.prototype, 'currentBroker', {
  get: function () {
    return this.connected ? this._lastConnectedBroker : null
  }
})

var EXPLICIT_SUBSCRIPTION_MESSAGE_TYPE = ''
function explicitSubscriptionCallback () {}

function addSubscription (client, topic, messageType,
                          callback, subscribeToTopic) {
  if (typeof (subscribeToTopic) === 'undefined') { subscribeToTopic = true }

  if (callback !== explicitSubscriptionCallback) {
    client._callbackManager.addCallback(messageType, topic, callback)
  }

  if (subscribeToTopic && topic) {
    var topicMessageTypes = client._subscriptionsByMessageType[topic]
    // Only subscribe for the topic with the broker if no prior
    // subscription has been established
    if (!topicMessageTypes) {
      if (client._mqttClient) {
        client._mqttClient.subscribe(topic)
      }
      topicMessageTypes = {}
      client._subscriptionsByMessageType[topic] = topicMessageTypes
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

function removeSubscription (client, topic, messageType, callback) {
  if (callback !== explicitSubscriptionCallback) {
    client._callbackManager.removeCallback(messageType, topic, callback)
  }

  if (topic) {
    var subscriptionsByMessageType = client._subscriptionsByMessageType
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
      if (client._mqttClient && !subscriptionsByMessageType[topic]) {
        client._mqttClient.unsubscribe(topic)
      }
    }
  }
}

function publish (client, topic, data) {
  if (client._mqttClient) {
    client._mqttClient.publish(topic, data)
  } else {
    throw new DxlError(
      'Client not connected, unable to publish data to: ' + topic)
  }
}

Client.prototype.connect = function (callback) {
  if (!this._servers.length) {
    throw new DxlError(
      'Unable to connect: no brokers specified in the client configuration')
  }

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
    that.emit('connect')
  })

  mqttClient.on('close', function () {
    that.emit('close')
  })

  mqttClient.on('error', function (error) {
    console.log(error.toString())
    that.emit('error', error)
  })

  mqttClient.on('message', function (topic, rawMessage) {
    var message = decodeMessage(rawMessage)
    message.destinationTopic = topic
    that._callbackManager.onMessage(message)
  })

  mqttClient.on('reconnect', function () {
    that.emit('reconnect')
  })

  this._mqttClient = mqttClient
}

Client.prototype.addEventCallback = function (topic,
                                              eventCallback,
                                              subscribeToTopic) {
  addSubscription(this, topic, message.MESSAGE_TYPE_EVENT, eventCallback,
    subscribeToTopic)
}

Client.prototype.removeEventCallback = function (topic, eventCallback) {
  removeSubscription(this, topic, message.MESSAGE_TYPE_EVENT,
    eventCallback)
}

Client.prototype.addRequestCallback = function (topic,
                                                   requestCallback,
                                                   subscribeToTopic) {
  addSubscription(this, topic, message.MESSAGE_TYPE_REQUEST,
    requestCallback, subscribeToTopic)
}

Client.prototype.removeRequestCallback = function (topic, requestCallback) {
  removeSubscription(this, topic, message.MESSAGE_TYPE_REQUEST,
    requestCallback)
}

Client.prototype.addResponseCallback = function (topic,
                                                    responseCallback,
                                                    subscribeToTopic) {
  addSubscription(this, topic, message.MESSAGE_TYPE_RESPONSE,
    responseCallback, subscribeToTopic)
  addSubscription(this, topic, message.MESSAGE_TYPE_ERROR,
    responseCallback, subscribeToTopic)
}

Client.prototype.removeResponseCallback = function (topic,
                                                    responseCallback) {
  removeSubscription(this, topic, message.MESSAGE_TYPE_RESPONSE,
    responseCallback)
  removeSubscription(this, topic, message.MESSAGE_TYPE_ERROR,
    responseCallback)
}

Client.prototype.subscribe = function (topic) {
  addSubscription(this, topic, EXPLICIT_SUBSCRIPTION_MESSAGE_TYPE,
    explicitSubscriptionCallback)
}

Client.prototype.unsubscribe = function (topic) {
  removeSubscription(this, topic, EXPLICIT_SUBSCRIPTION_MESSAGE_TYPE,
    explicitSubscriptionCallback)
}

Object.defineProperty(Client.prototype, 'subscriptions', {
  get: function () { return Object.keys(this._subscriptionsByMessageType) }
})

Client.prototype.asyncRequest = function (request, responseCallback) {
  this._requestManager.asyncRequest(request, responseCallback)
}

Client.prototype.sendEvent = function (event) {
  publish(this, event.destinationTopic, event._toBytes())
}

Client.prototype.sendResponse = function (response) {
  publish(this, response.destinationTopic, response._toBytes())
}

Client.prototype.registerServiceAsync = function (serviceRegInfo,
                                                  registrationCallback) {
  this._serviceManager.registerServiceAsync(serviceRegInfo,
    registrationCallback)
}

Client.prototype.unregisterServiceAsync = function (
  serviceRegInfo, unregistrationCallback) {
  this._serviceManager.unregisterServiceAsync(serviceRegInfo,
    unregistrationCallback)
}

Client.prototype.disconnect = function (callback) {
  if (this._mqttClient) {
    this._mqttClient.end(callback)
  }
}

Client.prototype.destroy = function (callback) {
  this._serviceManager.destroy()
  if (this._mqttClient) {
    var topics = Object.keys(this._subscriptionsByMessageType)
    if (topics.length) {
      this._mqttClient.unsubscribe(topics)
    }
  }
  this.disconnect(callback)
  this._subscriptionsByMessageType = {}
  this._callbackManager.destroy()
}

Client.prototype._sendRequest = function (request) {
  request.replyToTopic = this._replyToTopic
  publish(this, request.destinationTopic, request._toBytes())
}

module.exports = Client
