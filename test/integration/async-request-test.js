'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

const expect = require('chai').expect
const dxl = require('../..')
const Request = dxl.Request
const ServiceRegistrationInfo = dxl.ServiceRegistrationInfo
const util = require('../../lib/util')
const TestClient = require('./test-client')
const TestService = require('./test-service')
const testHelpers = require('../test-helpers')

describe('async requests @integration', function () {
  it('should receive a response for every request made', function (done) {
    const requestCount = 100
    const expectedRequestCount = requestCount * 2
    const expectedResponseCount = requestCount * 3
    let totalResponseCount = 0
    const requests = {}

    const client = new TestClient(this, done)
    client.connect(function () {
      const testService = new TestService(client)
      const topic = 'async_request_test_' + util.generateIdAsString()
      const regInfo = new ServiceRegistrationInfo(client,
        'async_request_test_service')
      regInfo.addTopic(topic, testService.callback)
      client.registerServiceAsync(regInfo)

      const responseCallback = function (response) {
        if (Object.prototype.hasOwnProperty.call(requests, response.requestMessageId)) {
          requests[response.requestMessageId] = requests[response.requestMessageId] + 1
          totalResponseCount++
          if (totalResponseCount === expectedResponseCount) {
            client.shutdown(null, function () {
              expect(Object.keys(requests).length).to.be.equal(expectedRequestCount)
              done()
            })
          }
        }
      }

      client.addResponseCallback('', responseCallback)

      const responseHandler = function (response) { responseCallback(response) }
      for (let i = 0; i < requestCount; i++) {
        let request = new Request(topic)
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
