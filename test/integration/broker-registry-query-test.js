'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

const expect = require('chai').expect
const dxl = require('../..')
const Request = dxl.Request
const Response = dxl.Response
const TestClient = require('./test-client')
const testHelpers = require('../test-helpers')

const DXL_BROKER_REGISTRY_QUERY_TOPIC = '/mcafee/service/dxl/brokerregistry/query'

describe('broker registry query @integration', function () {
  it('should return a proper response', function (done) {
    const client = new TestClient(this, done)
    client.connect(function () {
      const topic = DXL_BROKER_REGISTRY_QUERY_TOPIC
      const request = new Request(topic)
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
