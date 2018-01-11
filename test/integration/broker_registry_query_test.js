'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var expect = require('chai').expect
var Request = require('../../lib/request')
var Response = require('../../lib/response')
var TestClient = require('./test_client')
var testHelpers = require('./test_helpers')

describe('broker registry query @integration', function () {
  it('should return a proper response', function (done) {
    var testClient = new TestClient(this, done)
    var dxlClient = testClient.client
    dxlClient.connect(function () {
      var topic = '/mcafee/service/dxl/brokerregistry/query'
      var request = new Request(topic)
      request.payload = '{}'
      dxlClient.asyncRequest(request, function (error, response) {
        testClient.destroy(error, function () {
          expect(response).to.be.an.instanceof(Response)
          expect(response.sourceBrokerId).to.not.be.empty
          expect(response.sourceClientId).to.not.be.empty
          expect(testHelpers.messagePayloadAsJson(response)).to
            .be.an.instanceof(Object)
          done()
        })
      })
    })
  })
})
