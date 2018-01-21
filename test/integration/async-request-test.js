'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var expect = require('chai').expect
var Request = require('../../lib/request')
var ServiceRegistrationInfo = require('../../lib/service-registration-info')
var util = require('../../lib/util')
var TestClient = require('./test-client')
var TestService = require('./test-service')
var testHelpers = require('../test-helpers')

describe('async requests @integration', function () {
  it('should receive a response for every request made', function (done) {
    var requestCount = 100
    var expectedRequestCount = requestCount * 2
    var expectedResponseCount = requestCount * 3
    var totalResponseCount = 0
    var requests = {}

    var client = new TestClient(this, done)
    client.connect(function () {
      var testService = new TestService(client)
      var topic = 'async_request_test_' + util.generateIdAsString()
      var regInfo = new ServiceRegistrationInfo(client,
        'async_request_test_service')
      regInfo.addTopic(topic, testService.callback)
      client.registerServiceAsync(regInfo)

      var responseCallback = function (response) {
        if (requests.hasOwnProperty(response.requestMessageId)) {
          requests[response.requestMessageId] =
            requests[response.requestMessageId] + 1
          totalResponseCount++
          if (totalResponseCount === expectedResponseCount) {
            client.shutdown(null, function () {
              expect(Object.keys(requests).length).to.be
                .equal(expectedRequestCount)
              done()
            })
          }
        }
      }

      client.addResponseCallback('', responseCallback)

      var responseHandler = function (response) { responseCallback(response) }
      for (var i = 0; i < requestCount; i++) {
        var request = new Request(topic)
        requests[request.messageId] = 0
        client.asyncRequest(request)

        request = new Request(topic)
        requests[request.messageId] = 0
        testHelpers.asyncRequest(client, request, client.shutdown.bind(client),
          responseHandler
        )
      }
    })
  })
})
