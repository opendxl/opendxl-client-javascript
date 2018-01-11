'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var expect = require('chai').expect
var Request = require('../../lib/request')
var ServiceRegistrationInfo = require('../../lib/service_registration_info')
var util = require('../../lib/util')
var TestClient = require('./test_client')
var TestService = require('./test_service')

describe('async requests @integration', function () {
  it('should receive a response for every request made', function (done) {
    var requestCount = 100
    var expectedRequestCount = requestCount * 2
    var expectedResponseCount = requestCount * 3
    var totalResponseCount = 0
    var requests = {}

    var testClient = new TestClient(this, done)
    var dxlClient = testClient.client
    dxlClient.connect(function () {
      var testService = new TestService(dxlClient)
      var topic = 'async_request_test_' + util.generateIdAsString()
      var regInfo = new ServiceRegistrationInfo(dxlClient,
        'async_request_test_service')
      regInfo.addTopic(topic, testService.callback)
      dxlClient.registerServiceAsync(regInfo)

      var responseCallback = function (response) {
        if (requests.hasOwnProperty(response.requestMessageId)) {
          requests[response.requestMessageId] =
            requests[response.requestMessageId] + 1
          totalResponseCount++
          if (totalResponseCount === expectedResponseCount) {
            testClient.destroy(null, function () {
              expect(Object.keys(requests).length).to.be
                .equal(expectedRequestCount)
              done()
            })
          }
        }
      }

      dxlClient.addResponseCallback('', responseCallback)

      for (var i = 0; i < requestCount; i++) {
        var request = new Request(topic)
        requests[request.messageId] = 0
        dxlClient.asyncRequest(request)

        request = new Request(topic)
        requests[request.messageId] = 0
        dxlClient.asyncRequest(request, function (error, response) {
          if (error) {
            testClient.destroy(error)
          } else {
            responseCallback(response)
          }
        })
      }
    })
  })
})
