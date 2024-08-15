'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

const expect = require('chai').expect
const dxl = require('..')
const Client = dxl.Client
const Config = dxl.Config
const ErrorResponse = dxl.ErrorResponse
const Event = dxl.Event
const Request = dxl.Request
const Response = dxl.Response

describe('remove callback call to client', function () {
  const client = new Client(
    new Config('fake bundle', 'fake cert', 'fake key', [])
  )

  context('for event', function () {
    it('should prevent further messages from being delivered', function () {
      let callbackDeliveredWhileRegistered = false
      let callbackDeliveredAfterUnregistered = false
      let callbackRegistered = false

      const topic = 'event_callback_test_topic'

      const callback = function () {
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
      let callbackDeliveredWhileRegistered = false
      let callbackDeliveredAfterUnregistered = false
      let callbackRegistered = false

      const topic = 'request_callback_test_topic'

      const callback = function () {
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
      let callbackDeliveredWhileRegistered = false
      let callbackDeliveredAfterUnregistered = false
      let callbackRegistered = false

      const topic = 'response_callback_test_topic'

      const callback = function () {
        if (callbackRegistered) {
          callbackDeliveredWhileRegistered = true
        } else {
          callbackDeliveredAfterUnregistered = true
        }
      }

      client.addResponseCallback(topic, callback)
      callbackRegistered = true
      const responseWhileCallbackRegistered = new Response()
      responseWhileCallbackRegistered.destinationTopic = topic
      client._callbackManager.onMessage(responseWhileCallbackRegistered)
      expect(callbackDeliveredWhileRegistered).to.be.true

      client.removeResponseCallback(topic, callback)
      callbackRegistered = false
      const responseAfterCallbackUnregistered = new Response()
      responseAfterCallbackUnregistered.destinationTopic = topic
      client._callbackManager.onMessage(responseAfterCallbackUnregistered)
      expect(callbackDeliveredAfterUnregistered).to.be.false
    })
  })

  context('for error response', function () {
    it('should prevent further messages from being delivered', function () {
      let callbackDeliveredWhileRegistered = false
      let callbackDeliveredAfterUnregistered = false
      let callbackRegistered = false

      const topic = 'error_response_callback_test_topic'

      const callback = function () {
        if (callbackRegistered) {
          callbackDeliveredWhileRegistered = true
        } else {
          callbackDeliveredAfterUnregistered = true
        }
      }

      client.addResponseCallback(topic, callback)
      callbackRegistered = true
      const errorResponseWhileCallbackRegistered = new ErrorResponse()
      errorResponseWhileCallbackRegistered.destinationTopic = topic
      client._callbackManager.onMessage(errorResponseWhileCallbackRegistered)
      expect(callbackDeliveredWhileRegistered).to.be.true

      client.removeResponseCallback(topic, callback)
      callbackRegistered = false
      const errorResponseAfterCallbackUnregistered = new ErrorResponse()
      errorResponseAfterCallbackUnregistered.destinationTopic = topic
      client._callbackManager.onMessage(errorResponseAfterCallbackUnregistered)
      expect(callbackDeliveredAfterUnregistered).to.be.false
    })
  })
})
