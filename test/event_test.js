'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var expect = require('chai').expect
var Buffer = require('safe-buffer').Buffer
var decodeMessage = require('../lib/decode_message')
var Event = require('../lib/event')
var util = require('../lib/util')
var testHelpers = require('./test_helpers')

describe('Event', function () {
  context('when fields are mostly set to defaults', function () {
    it('should preserve all data through serialization', function () {
      var topic = 'my_event_topic'
      var event = new Event('my_event_topic')

      expect(event.destinationTopic).to.equal(topic)

      var encodedEvent = event._toBytes()
      expect(encodedEvent).to.be.an.instanceOf(Buffer)

      var decodedEvent = decodeMessage(encodedEvent)
      decodedEvent.destinationTopic = event.destinationTopic
      decodedEvent.payload = testHelpers.decodePayload(decodedEvent)
      expect(decodedEvent).to.be.eql(event)
    })
  })

  context('when all fields have non-default values', function () {
    it('should preserve all data through serialization', function () {
      var event = new Event('my_event_topic')
      event.sourceClientId = util.generateIdAsString()
      event.sourceBrokerId = util.generateIdAsString()
      event.payload = 'my event payload'
      event.brokerIds = [ util.generateIdAsString(), util.generateIdAsString() ]
      event.clientIds = [ util.generateIdAsString() ]
      event.otherFields = { field1: 'val1', field2: 'val2' }
      event.sourceTenantGuid = util.generateIdAsString()
      event.destinationTenantGuids = [ util.generateIdAsString() ]

      var encodedEvent = event._toBytes()
      expect(encodedEvent).to.be.an.instanceOf(Buffer)

      var decodedEvent = decodeMessage(encodedEvent)
      decodedEvent.destinationTopic = event.destinationTopic
      decodedEvent.payload = testHelpers.decodePayload(decodedEvent)
      expect(decodedEvent).to.be.eql(event)
    })
  })
})
