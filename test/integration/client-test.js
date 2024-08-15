'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

const expect = require('chai').expect
const dxl = require('../..')
const ErrorResponse = dxl.ErrorResponse
const Event = dxl.Event
const Request = dxl.Request
const RequestError = dxl.RequestError
const ResponseErrorCode = dxl.ResponseErrorCode
const ServiceRegistrationInfo = dxl.ServiceRegistrationInfo
const util = require('../../lib/util')
const TestClient = require('./test-client')
const testHelpers = require('../test-helpers')
const TestService = require('./test-service')

describe('Client @integration', function () {
  it('should connect and disconnect to a broker without error',
    function (done) {
      const client = new TestClient(this, done)
      client.connect(function () {
        const initiallyConnected = client.connected
        client.disconnect(function () {
          client.shutdown(null, function () {
            expect(initiallyConnected).to.be.true
            expect(client.connected).to.be.false
            done()
          })
        })
      })
    }
  )

  it('should be able to request a disconnect while still connecting',
    function (done) {
      const client = new TestClient(this.done)
      client.connect()
      client.disconnect(function () {
        expect(client.connected).to.be.false
        done()
      })
    }
  )

  it('should set current broker while connected',
    function (done) {
      const client = new TestClient(this, done)
      const currentBrokerBeforeConnected = client.currentBroker
      client.connect(function () {
        const currentBrokerWhileConnected = client.currentBroker
        client.disconnect(function () {
          const currentBrokerAfterDisconnected = client.currentBroker
          client.shutdown(null, function () {
            expect(currentBrokerBeforeConnected).to.be.null
            expect(client.config.brokers).to.include(
              currentBrokerWhileConnected
            )
            expect(currentBrokerAfterDisconnected).to.be.null
            done()
          })
        })
      })
    }
  )

  it('should subscribe and unsubscribe to a topic without error',
    function (done) {
      const client = new TestClient(this, done)
      const topic = 'client_spec_subscribe_' + util.generateIdAsString()
      client.connect(function () {
        client.subscribe(topic)
        const subscriptionsAfterSubscribe = client.subscriptions
        client.unsubscribe(topic)
        const subscriptionsAfterUnsubscribe = client.subscriptions
        client.shutdown(null, function () {
          expect(subscriptionsAfterSubscribe).to.include(topic)
          expect(subscriptionsAfterUnsubscribe).to.not.include(topic)
          done()
        })
      })
    }
  )

  it('should receive an error response from a registered service',
    function (done) {
      const errorCode = 9090
      const errorMessage = 'My error message'
      const topic = 'client_test_error_message_registered_service_' +
        util.generateIdAsString()

      const client = new TestClient(this, done)
      client.connect()

      const testService = new TestService(client)
      testService.returnError = true
      testService.errorCode = errorCode
      testService.errorMessage = errorMessage

      const regInfo = new ServiceRegistrationInfo(client,
        'client_test_error_message_service')
      regInfo.addTopic(topic, testService.callback)
      client.registerServiceAsync(regInfo, function () {
        client.asyncRequest(new Request(topic), function (error, response) {
          client.shutdown(null, function () {
            expect(response).to.be.null
            expect(error).to.be.an.instanceof(RequestError)
            expect(error.message).to.equal(errorMessage)
            expect(error.dxlErrorResponse).to.be.an.instanceof(ErrorResponse)
            expect(error.dxlErrorResponse.errorCode).to.equal(errorCode)
            done()
          })
        })
      })
    }
  )

  it('should receive an error response for a request to an unknown service',
    function (done) {
      const topic = 'client_test_error_message_unknown_service_' +
        util.generateIdAsString()
      const client = new TestClient(this, done)
      client.connect()

      const request = new Request(topic)
      request.serviceId = util.generateIdAsString()

      client.asyncRequest(request, function (error, response) {
        client.shutdown(null, function () {
          expect(response).to.be.null
          expect(error).to.be.an.instanceof(RequestError)
          expect(error.code).to.equal(ResponseErrorCode.SERVICE_UNAVAILABLE)
          expect(error.message).to.equal(
            testHelpers.DXL_SERVICE_UNAVAILABLE_ERROR_MESSAGE)
          expect(error.dxlErrorResponse).to.be.an.instanceof(ErrorResponse)
          expect(error.dxlErrorResponse.serviceId).to.equal(request.serviceId)
          done()
        })
      })
    }
  )

  it('should be able to receive an event after reconnecting', function (done) {
    const topic = 'client_test_event_after_reconnect_' +
      util.generateIdAsString()
    const eventPayloadToSend = 'sent after reconnect'
    const client = new TestClient(this, done)
    let clientWasDisconnectedAfterFirstConnect = false
    client.addEventCallback(topic, function (event) {
      client.shutdown(null, function () {
        expect(clientWasDisconnectedAfterFirstConnect).to.be.true
        const eventPayloadReceived = testHelpers.decodePayload(event)
        expect(eventPayloadReceived).to.equal(eventPayloadToSend)
        done()
      })
    })
    client.connect(function () {
      client.disconnect(function () {
        clientWasDisconnectedAfterFirstConnect = !client.connected
        client.connect(function () {
          const event = new Event(topic)
          event.payload = eventPayloadToSend
          client.sendEvent(event)
        })
      })
    })
  })
})
