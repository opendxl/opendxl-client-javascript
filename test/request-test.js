'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

const expect = require('chai').expect
const Buffer = require('safe-buffer').Buffer
const decodeMessage = require('../lib/decode-message')
const Request = require('..').Request
const util = require('../lib/util')
const testHelpers = require('./test-helpers')

describe('Request', function () {
  context('when fields are mostly set to defaults', function () {
    it('should preserve all data through serialization', function () {
      const topic = 'my_request_topic'
      const request = new Request(topic)

      expect(request.destinationTopic).to.equal(topic)

      const encodedRequest = request._toBytes()
      expect(Buffer.isBuffer(encodedRequest)).to.be.true

      const decodedRequest = decodeMessage(encodedRequest)
      decodedRequest.destinationTopic = request.destinationTopic
      decodedRequest.payload = testHelpers.decodePayload(decodedRequest)
      expect(decodedRequest).to.be.eql(request)
    })
  })

  context('when all fields have non-default values', function () {
    it('should preserve all data through serialization', function () {
      const request = new Request('my_request_topic')
      request.replyToTopic = 'my reply topic'
      request.serviceId = util.generateIdAsString()
      request.sourceClientId = util.generateIdAsString()
      request.sourceBrokerId = util.generateIdAsString()
      request.payload = 'my request payload'
      request.brokerIds = [
        util.generateIdAsString(),
        util.generateIdAsString()
      ]
      request.clientIds = [util.generateIdAsString()]
      request.otherFields = { field1: 'val1', field2: 'val2' }
      request.sourceTenantGuid = util.generateIdAsString()
      request.destinationTenantGuids = [util.generateIdAsString()]

      const encodedRequest = request._toBytes()
      expect(Buffer.isBuffer(encodedRequest)).to.be.true

      const decodedRequest = decodeMessage(encodedRequest)
      decodedRequest.destinationTopic = request.destinationTopic
      decodedRequest.payload = testHelpers.decodePayload(decodedRequest)
      expect(decodedRequest).to.be.eql(request)
    })
  })

  context('payload', function () {
    context('when set to a binary buffer', function () {
      it('should be preserved through serialization', function () {
        const request = new Request('')
        request.payload = Buffer.from([0x01, 0xD1, 0x9A])

        const encodedRequest = request._toBytes()
        expect(Buffer.isBuffer(encodedRequest)).to.be.true

        const decodedRequest = decodeMessage(encodedRequest)
        expect(decodedRequest.payload).to.be.eql(request.payload)
      })
    })

    context('when set to an object', function () {
      it('should be serialized as a string', function () {
        const request = new Request('')
        request.payload = { hello: 'how are you', fine: 'thanks' }

        const encodedRequest = request._toBytes()
        expect(Buffer.isBuffer(encodedRequest)).to.be.true

        const decodedRequest = decodeMessage(encodedRequest)
        expect(testHelpers.jsonPayloadToObject(
          decodedRequest)).to.be.eql(request.payload)
      })
    })

    context('when set to a number', function () {
      it('should be serialized as a string', function () {
        const request = new Request('')
        request.payload = 42

        const encodedRequest = request._toBytes()
        expect(Buffer.isBuffer(encodedRequest)).to.be.true

        const decodedRequest = decodeMessage(encodedRequest)
        expect(Number(testHelpers.decodePayload(
          decodedRequest))).to.be.equal(request.payload)
      })
    })
  })
})
