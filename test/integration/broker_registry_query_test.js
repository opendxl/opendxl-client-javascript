'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var expect = require('chai').expect
var Request = require('../../lib/request')
var Response = require('../../lib/response')
var TestClient = require('./test_client')
var testHelpers = require('../test_helpers')

describe('broker registry query @integration', function () {
  it('should return a proper response', function (done) {
    var client = new TestClient(this, done)
    client.connect(function () {
      var topic = '/mcafee/service/dxl/brokerregistry/query'
      var request = new Request(topic)
      request.payload = '{}'
      client.asyncRequest(request, function (error, response) {
        client.shutdown(error, function () {
          expect(response).to.be.an.instanceof(Response)
          expect(response.sourceBrokerId).to.not.be.empty
          expect(response.sourceClientId).to.not.be.empty
          expect(testHelpers.jsonPayloadToObject(response)).to
            .be.an.instanceof(Object)
          done()
        })
      })
    })
  })
})
