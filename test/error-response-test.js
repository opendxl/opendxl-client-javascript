'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

const expect = require('chai').expect
const Buffer = require('safe-buffer').Buffer
const decodeMessage = require('../lib/decode-message')
const dxl = require('..')
const Request = dxl.Request
const ErrorResponse = dxl.ErrorResponse
const util = require('../lib/util')
const testHelpers = require('./test-helpers')

describe('ErrorResponse', function () {
  context('when fields are mostly set to defaults', function () {
    it('should preserve all data through serialization', function () {
      const errorResponse = new ErrorResponse()

      expect(errorResponse.errorCode).to.equal(0)
      expect(errorResponse.errorMessage).to.be.empty

      const encodedResponse = errorResponse._toBytes()
      expect(Buffer.isBuffer(encodedResponse)).to.be.true

      const decodedResponse = decodeMessage(encodedResponse)
      decodedResponse.destinationTopic = errorResponse.destinationTopic
      decodedResponse.payload = testHelpers.decodePayload(decodedResponse)
      expect(decodedResponse).to.be.eql(errorResponse)
    })
  })

  context('when all fields have non-default values', function () {
    it('should preserve all data through serialization', function () {
      const request = new Request('my_request_topic')
      request.replyToTopic = 'my reply topic'
      request.serviceId = util.generateIdAsString()
      request.sourceClientId = util.generateIdAsString()
      request.sourceBrokerId = util.generateIdAsString()

      const errorCode = 999
      const errorMessage = 'Some error occurred'

      const errorResponse = new ErrorResponse(request, errorCode, errorMessage)

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
      errorResponse.destinationTenantGuids = [util.generateIdAsString()]

      const encodedResponse = errorResponse._toBytes()
      expect(Buffer.isBuffer(encodedResponse)).to.be.true

      const decodedResponse = decodeMessage(encodedResponse)
      decodedResponse.destinationTopic = errorResponse.destinationTopic
      decodedResponse.payload = testHelpers.decodePayload(decodedResponse)
      errorResponse.request = null

      expect(decodedResponse).to.be.eql(errorResponse)
    })
  })
})
