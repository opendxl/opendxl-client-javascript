'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var expect = require('chai').expect
var Buffer = require('safe-buffer').Buffer
var decodeMessage = require('../lib/decode_message')
var Request = require('../lib/request')
var Response = require('../lib/response')
var util = require('../lib/util')
var testHelpers = require('./integration/test_helpers')

describe('Response', function () {
  context('when fields are mostly set to defaults', function () {
    it('should preserve all data through serialization', function () {
      var response = new Response()

      var encodedResponse = response._toBytes()
      expect(encodedResponse).to.be.an.instanceOf(Buffer)

      var decodedResponse = decodeMessage(encodedResponse)
      decodedResponse.destinationTopic = response.destinationTopic
      decodedResponse.payload = testHelpers.decodePayload(decodedResponse)
      expect(decodedResponse).to.be.eql(response)
    })
  })

  context('when all fields have non-default values', function () {
    it('should preserve all data through serialization', function () {
      var request = new Request('my_request_topic')
      request.replyToTopic = 'my reply topic'
      request.serviceId = util.generateIdAsString()
      request.sourceClientId = util.generateIdAsString()
      request.sourceBrokerId = util.generateIdAsString()

      var response = new Response(request)

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
      response.destinationTenantGuids = [ util.generateIdAsString() ]

      var encodedResponse = response._toBytes()
      expect(encodedResponse).to.be.an.instanceOf(Buffer)

      var decodedResponse = decodeMessage(encodedResponse)
      decodedResponse.destinationTopic = response.destinationTopic
      decodedResponse.payload = testHelpers.decodePayload(decodedResponse)
      response.request = null

      expect(decodedResponse).to.be.eql(response)
    })
  })
})
