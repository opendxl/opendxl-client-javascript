'use strict'
var fs = require('fs')
var mqtt = require('mqtt')

var CallbackManager = require('./_callback_manager')
var decodeMessage = require('./_decode_message')
var message = require('./message')
var RequestManager = require('./_request_manager')
var ServiceManager = require('./_service_manager')
var util = require('./util')

const REPLY_TO_PREFIX = '/mcafee/client/'

function DxlClient () {
  this._clientId = util.generateIdAsString()
  this._replyToTopic = REPLY_TO_PREFIX + this._clientId
  this._mqttClient = null
  this._subscriptions = {}

  this._callbackManager = new CallbackManager(this)
  this._requestManager = new RequestManager(this, this._replyToTopic)
  this._serviceManager = new ServiceManager(this)
}

Object.defineProperty(DxlClient.prototype, 'connected', {
  get: function () {
    return this._mqttClient ? this._mqttClient.connected : false
  }
})

var addSubscription = function (topic, source, subscribeToTopic) {
  if (typeof (subscribeToTopic) === 'undefined') { subscribeToTopic = true }
  if (subscribeToTopic && topic) {
    var registeredTopic = this._subscriptions[topic]
    if (!registeredTopic) {
      if (this._mqttClient) {
        this._mqttClient.subscribe(topic)
      }
      registeredTopic = {}
      this._subscriptions[topic] = registeredTopic
    }

    var registeredSource = registeredTopic[source]
    if (registeredSource) {
      registeredTopic[source] += 1
    } else {
      registeredTopic[source] = 0
    }
  }
}

DxlClient.prototype.connect = function (callback) {
  var that = this
  var firstConnection = true

  var mqttClient = mqtt.connect(
    {
      host: '192.168.99.100',
      port: '8883',
      protocol: 'mqtts',
      clientId: this._clientId,
      key: fs.readFileSync('client.key'),
      cert: fs.readFileSync('client.crt'),
      ca: fs.readFileSync('ca-broker.crt'),
      checkServerIdentity: function () {
        return undefined
      },
      rejectUnauthorized: true,
      requestCert: true
    })

  Object.keys(this._subscriptions).forEach(function (topic) {
    mqttClient.subscribe(topic)
  })

  mqttClient.on('connect', function () {
    console.log('Connected')
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

  mqttClient.on('close', function (error) {
    console.log('Closed: ' +
      ((typeof (error) === 'undefined') ? 'no error' : error.toString()))
  })

  mqttClient.on('error', function (error) {
    console.log('Error: ' + error.toString())
  })

  this._mqttClient = mqttClient
}

DxlClient.prototype.addEventCallback = function (topic,
                                                 eventCallback,
                                                 subscribeToTopic) {
  addSubscription.call(this, topic, eventCallback, subscribeToTopic)
  this._callbackManager.addCallback(message.MESSAGE_TYPE_EVENT, topic,
    eventCallback)
}

DxlClient.prototype.addRequestCallback = function (topic,
                                                   requestCallback,
                                                   subscribeToTopic) {
  addSubscription.call(this, topic, requestCallback, subscribeToTopic)
  this._callbackManager.addCallback(message.MESSAGE_TYPE_REQUEST, topic,
    requestCallback)
}

DxlClient.prototype.addResponseCallback = function (topic,
                                                    responseCallback,
                                                    subscribeToTopic) {
  addSubscription.call(this, topic, responseCallback, subscribeToTopic)
  this._callbackManager.addCallback(message.MESSAGE_TYPE_RESPONSE,
    topic, responseCallback)
  this._callbackManager.addCallback(message.MESSAGE_TYPE_ERROR,
    topic, responseCallback)
}

DxlClient.prototype.asyncRequest = function (request, responseCallback) {
  this._requestManager.asyncRequest(request, responseCallback)
}

DxlClient.prototype.sendEvent = function (event) {
  this._mqttClient.publish(event.destinationTopic, event._toBytes())
}

DxlClient.prototype.sendResponse = function (response) {
  this._mqttClient.publish(response.destinationTopic, response._toBytes())
}

DxlClient.prototype.registerServiceAsync = function (serviceRegInfo,
                                                     registrationCallback) {
  this._serviceManager.registerServiceAsync(serviceRegInfo,
    registrationCallback)
}

DxlClient.prototype.disconnect = function () {
  if (this._mqttClient) {
    this._mqttClient.end()
  }
}

DxlClient.prototype.destroy = function () {
  this._serviceManager.destroy()
  if (this._mqttClient) {
    var topics = Object.keys(this._subscriptions)
    if (topics.length) {
      this._mqttClient.unsubscribe(topics)
    }
  }
  this.disconnect()
  this._subscriptions = {}
}

DxlClient.prototype._sendRequest = function (request) {
  request.replyToTopic = this._replyToTopic
  this._mqttClient.publish(request.destinationTopic, request._toBytes())
}

module.exports = DxlClient
