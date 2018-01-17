'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var expect = require('chai').expect
var MessageError = require('../../lib/message_error')
var ErrorResponse = require('../../lib/error_response')
var Request = require('../../lib/request')
var ServiceRegistrationInfo = require('../../lib/service_registration_info')
var util = require('../../lib/util')
var TestClient = require('./test_client')
var TestService = require('./test_service')

describe('Client @integration', function () {
  it('should connect and disconnect to a broker without error',
    function (done) {
      var client = new TestClient(this, done)
      client.connect(function () {
        var initiallyConnected = client.connected
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

  it('should set current broker while connected',
    function (done) {
      var client = new TestClient(this, done)
      var currentBrokerBeforeConnected = client.currentBroker
      client.connect(function () {
        var currentBrokerWhileConnected = client.currentBroker
        client.disconnect(function () {
          var currentBrokerAfterDisconnected = client.currentBroker
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
      var client = new TestClient(this, done)
      var topic = 'client_spec_subscribe_' + util.generateIdAsString()
      client.connect(function () {
        client.subscribe(topic)
        var subscriptionsAfterSubscribe = client.subscriptions
        client.unsubscribe(topic)
        var subscriptionsAfterUnsubscribe = client.subscriptions
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
      var errorCode = 9090
      var errorMessage = 'My error message'
      var topic = 'client_test_error_message_registered_service_' +
        util.generateIdAsString()

      var client = new TestClient(this, done)
      client.connect()

      var testService = new TestService(client)
      testService.returnError = true
      testService.errorCode = errorCode
      testService.errorMessage = errorMessage

      var regInfo = new ServiceRegistrationInfo(client,
        'client_test_error_message_service')
      regInfo.addTopic(topic, testService.callback)
      client.registerServiceAsync(regInfo, function () {
        client.asyncRequest(new Request(topic), function (error, response) {
          client.shutdown(null, function () {
            expect(response).to.be.null
            expect(error).to.be.an.instanceof(MessageError)
            expect(error.code).to.equal(errorCode)
            expect(error.message).to.equal(errorMessage)
            expect(error.detail).to.be.an.instanceof(ErrorResponse)
            done()
          })
        })
      })
    }
  )

  it('should receive an error response for a request to an unknown service',
    function (done) {
      var topic = 'client_test_error_message_unknown_service_' +
        util.generateIdAsString()
      var client = new TestClient(this, done)
      client.connect()

      var request = new Request(topic)
      request.serviceId = util.generateIdAsString()

      client.asyncRequest(request, function (error, response) {
        client.shutdown(null, function () {
          expect(response).to.be.null
          expect(error).to.be.an.instanceof(MessageError)
          expect(error.detail).to.be.an.instanceof(ErrorResponse)
          expect(error.detail.serviceId).to.equal(request.serviceId)
          done()
        })
      })
    }
  )
})
