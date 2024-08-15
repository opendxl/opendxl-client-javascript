'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

const expect = require('chai').expect
const Buffer = require('safe-buffer').Buffer
const decodeMessage = require('../lib/decode-message')
const dxl = require('..')
const Request = dxl.Request
const Response = dxl.Response
const util = require('../lib/util')
const testHelpers = require('./test-helpers')

describe('Response', function () {
  context('when fields are mostly set to defaults', function () {
    it('should preserve all data through serialization', function () {
      const response = new Response()

      const encodedResponse = response._toBytes()
      expect(Buffer.isBuffer(encodedResponse)).to.be.true

      const decodedResponse = decodeMessage(encodedResponse)
      decodedResponse.destinationTopic = response.destinationTopic
      decodedResponse.payload = testHelpers.decodePayload(decodedResponse)
      expect(decodedResponse).to.be.eql(response)
    })
  })

  context('when all fields have non-default values', function () {
    it('should preserve all data through serialization', function () {
      const request = new Request('my_request_topic')
      request.replyToTopic = 'my reply topic'
      request.serviceId = util.generateIdAsString()
      request.sourceClientId = util.generateIdAsString()
      request.sourceBrokerId = util.generateIdAsString()

      const response = new Response(request)

      expect(response.destinationTopic).to.equal(request.replyToTopic)
      expect(response.request).to.equal(request)
      expect(response.requestMessageId).to.equal(request.messageId)
      expect(response.serviceId).to.equal(request.serviceId)
      expect(response.clientIds).to.eql([request.sourceClientId])
      expect(response.brokerIds).to.eql([request.sourceBrokerId])

      response.sourceClientId = util.generateIdAsString()
      response.sourceBrokerId = util.generateIdAsString()
      response.payload = 'my response payload'
      response.otherFields = { respField1: 'respVal1', respField2: 'respVal2' }
      response.sourceTenantGuid = util.generateIdAsString()
      response.destinationTenantGuids = [util.generateIdAsString()]

      const encodedResponse = response._toBytes()
      expect(Buffer.isBuffer(encodedResponse)).to.be.true

      const decodedResponse = decodeMessage(encodedResponse)
      decodedResponse.destinationTopic = response.destinationTopic
      decodedResponse.payload = testHelpers.decodePayload(decodedResponse)
      response.request = null

      expect(decodedResponse).to.be.eql(response)
    })
  })
})
