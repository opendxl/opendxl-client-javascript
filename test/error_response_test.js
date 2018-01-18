'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var expect = require('chai').expect
var Buffer = require('safe-buffer').Buffer
var decodeMessage = require('../lib/decode_message')
var Request = require('../lib/request')
var ErrorResponse = require('../lib/error_response')
var util = require('../lib/util')
var testHelpers = require('./test_helpers')

describe('ErrorResponse', function () {
  context('when fields are mostly set to defaults', function () {
    it('should preserve all data through serialization', function () {
      var errorResponse = new ErrorResponse()

      expect(errorResponse.errorCode).to.equal(0)
      expect(errorResponse.errorMessage).to.be.empty

      var encodedResponse = errorResponse._toBytes()
      expect(encodedResponse).to.be.an.instanceOf(Buffer)

      var decodedResponse = decodeMessage(encodedResponse)
      decodedResponse.destinationTopic = errorResponse.destinationTopic
      decodedResponse.payload = testHelpers.decodePayload(decodedResponse)
      expect(decodedResponse).to.be.eql(errorResponse)
    })
  })

  context('when all fields have non-default values', function () {
    it('should preserve all data through serialization', function () {
      var request = new Request('my_request_topic')
      request.replyToTopic = 'my reply topic'
      request.serviceId = util.generateIdAsString()
      request.sourceClientId = util.generateIdAsString()
      request.sourceBrokerId = util.generateIdAsString()

      var errorCode = 999
      var errorMessage = 'Some error occurred'

      var errorResponse = new ErrorResponse(request, errorCode, errorMessage)

      expect(errorResponse.errorCode).to.equal(errorCode)
      expect(errorResponse.errorMessage).to.equal(errorMessage)
      expect(errorResponse.destinationTopic).to.equal(request.replyToTopic)
      expect(errorResponse.request).to.equal(request)
      expect(errorResponse.requestMessageId).to.equal(request.messageId)
      expect(errorResponse.serviceId).to.equal(request.serviceId)
      expect(errorResponse.clientIds).to.eql([request.sourceClientId])
      expect(errorResponse.brokerIds).to.eql([request.sourceBrokerId])

      errorResponse.sourceClientId = util.generateIdAsString()
      errorResponse.sourceBrokerId = util.generateIdAsString()
      errorResponse.payload = 'my response payload'
      errorResponse.otherFields = {
        respField1: 'respVal1',
        respField2: 'respVal2'
      }
      errorResponse.sourceTenantGuid = util.generateIdAsString()
      errorResponse.destinationTenantGuids = [ util.generateIdAsString() ]

      var encodedResponse = errorResponse._toBytes()
      expect(encodedResponse).to.be.an.instanceOf(Buffer)

      var decodedResponse = decodeMessage(encodedResponse)
      decodedResponse.destinationTopic = errorResponse.destinationTopic
      decodedResponse.payload = testHelpers.decodePayload(decodedResponse)
      errorResponse.request = null

      expect(decodedResponse).to.be.eql(errorResponse)
    })
  })
})
