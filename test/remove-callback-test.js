'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var expect = require('chai').expect
var Client = require('../lib/client')
var Config = require('../lib/config')
var ErrorResponse = require('../lib/error-response')
var Event = require('../lib/event')
var Request = require('../lib/request')
var Response = require('../lib/response')

describe('remove callback call to client', function () {
  var client = new Client(
    new Config('fake bundle', 'fake cert', 'fake key', [])
  )

  context('for event', function () {
    it('should prevent further messages from being delivered', function () {
      var callbackDeliveredWhileRegistered = false
      var callbackDeliveredAfterUnregistered = false
      var callbackRegistered = false

      var topic = 'event_callback_test_topic'

      var callback = function () {
        if (callbackRegistered) {
          callbackDeliveredWhileRegistered = true
        } else {
          callbackDeliveredAfterUnregistered = true
        }
      }

      client.addEventCallback(topic, callback)
      callbackRegistered = true
      client._callbackManager.onMessage(new Event(topic))
      expect(callbackDeliveredWhileRegistered).to.be.true

      client.removeEventCallback(topic, callback)
      callbackRegistered = false
      client._callbackManager.onMessage(new Event(topic))
      expect(callbackDeliveredAfterUnregistered).to.be.false
    })
  })

  context('for request', function () {
    it('should prevent further messages from being delivered', function () {
      var callbackDeliveredWhileRegistered = false
      var callbackDeliveredAfterUnregistered = false
      var callbackRegistered = false

      var topic = 'request_callback_test_topic'

      var callback = function () {
        if (callbackRegistered) {
          callbackDeliveredWhileRegistered = true
        } else {
          callbackDeliveredAfterUnregistered = true
        }
      }

      client.addRequestCallback(topic, callback)
      callbackRegistered = true
      client._callbackManager.onMessage(new Request(topic))
      expect(callbackDeliveredWhileRegistered).to.be.true

      client.removeRequestCallback(topic, callback)
      callbackRegistered = false
      client._callbackManager.onMessage(new Request(topic))
      expect(callbackDeliveredAfterUnregistered).to.be.false
    })
  })

  context('for response', function () {
    it('should prevent further messages from being delivered', function () {
      var callbackDeliveredWhileRegistered = false
      var callbackDeliveredAfterUnregistered = false
      var callbackRegistered = false

      var topic = 'response_callback_test_topic'

      var callback = function () {
        if (callbackRegistered) {
          callbackDeliveredWhileRegistered = true
        } else {
          callbackDeliveredAfterUnregistered = true
        }
      }

      client.addResponseCallback(topic, callback)
      callbackRegistered = true
      var responseWhileCallbackRegistered = new Response()
      responseWhileCallbackRegistered.destinationTopic = topic
      client._callbackManager.onMessage(responseWhileCallbackRegistered)
      expect(callbackDeliveredWhileRegistered).to.be.true

      client.removeResponseCallback(topic, callback)
      callbackRegistered = false
      var responseAfterCallbackUnregistered = new Response()
      responseAfterCallbackUnregistered.destinationTopic = topic
      client._callbackManager.onMessage(responseAfterCallbackUnregistered)
      expect(callbackDeliveredAfterUnregistered).to.be.false
    })
  })

  context('for error response', function () {
    it('should prevent further messages from being delivered', function () {
      var callbackDeliveredWhileRegistered = false
      var callbackDeliveredAfterUnregistered = false
      var callbackRegistered = false

      var topic = 'error_response_callback_test_topic'

      var callback = function () {
        if (callbackRegistered) {
          callbackDeliveredWhileRegistered = true
        } else {
          callbackDeliveredAfterUnregistered = true
        }
      }

      client.addResponseCallback(topic, callback)
      callbackRegistered = true
      var errorResponseWhileCallbackRegistered = new ErrorResponse()
      errorResponseWhileCallbackRegistered.destinationTopic = topic
      client._callbackManager.onMessage(errorResponseWhileCallbackRegistered)
      expect(callbackDeliveredWhileRegistered).to.be.true

      client.removeResponseCallback(topic, callback)
      callbackRegistered = false
      var errorResponseAfterCallbackUnregistered = new ErrorResponse()
      errorResponseAfterCallbackUnregistered.destinationTopic = topic
      client._callbackManager.onMessage(errorResponseAfterCallbackUnregistered)
      expect(callbackDeliveredAfterUnregistered).to.be.false
    })
  })
})
