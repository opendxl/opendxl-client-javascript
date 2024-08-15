'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

const expect = require('chai').expect
const Buffer = require('safe-buffer').Buffer
const decodeMessage = require('../lib/decode-message')
const Event = require('..').Event
const util = require('../lib/util')
const testHelpers = require('./test-helpers')

describe('Event', function () {
  context('when fields are mostly set to defaults', function () {
    it('should preserve all data through serialization', function () {
      const topic = 'my_event_topic'
      const event = new Event('my_event_topic')

      expect(event.destinationTopic).to.equal(topic)

      const encodedEvent = event._toBytes()
      expect(Buffer.isBuffer(encodedEvent)).to.be.true

      const decodedEvent = decodeMessage(encodedEvent)
      decodedEvent.destinationTopic = event.destinationTopic
      decodedEvent.payload = testHelpers.decodePayload(decodedEvent)
      expect(decodedEvent).to.be.eql(event)
    })
  })

  context('when all fields have non-default values', function () {
    it('should preserve all data through serialization', function () {
      const event = new Event('my_event_topic')
      event.sourceClientId = util.generateIdAsString()
      event.sourceBrokerId = util.generateIdAsString()
      event.payload = 'my event payload'
      event.brokerIds = [util.generateIdAsString(), util.generateIdAsString()]
      event.clientIds = [util.generateIdAsString()]
      event.otherFields = { field1: 'val1', field2: 'val2' }
      event.sourceTenantGuid = util.generateIdAsString()
      event.destinationTenantGuids = [util.generateIdAsString()]

      const encodedEvent = event._toBytes()
      expect(Buffer.isBuffer(encodedEvent)).to.be.true

      const decodedEvent = decodeMessage(encodedEvent)
      decodedEvent.destinationTopic = event.destinationTopic
      decodedEvent.payload = testHelpers.decodePayload(decodedEvent)
      expect(decodedEvent).to.be.eql(event)
    })
  })
})
