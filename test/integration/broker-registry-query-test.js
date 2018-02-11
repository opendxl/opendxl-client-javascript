'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var expect = require('chai').expect
var dxl = require('../..')
var Request = dxl.Request
var Response = dxl.Response
var TestClient = require('./test-client')
var testHelpers = require('../test-helpers')

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
