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

  it('should properly receive an error response from a service',
    function (done) {
      var errorCode = 9090
      var errorMessage = 'My error message'
      var topic = 'client_test_error_message_' + util.generateIdAsString()

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
})
