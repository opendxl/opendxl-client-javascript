'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

const expect = require('chai').expect
const Event = require('../..').Event
const util = require('../../lib/util')
const TestClient = require('./test-client')

describe('"other fields" in an event message @integration', function () {
  it('should be delivered with the expected content', function (done) {
    const otherFieldsCount = 1000

    const client = new TestClient(this, done)
    client.connect(function () {
      const topic = 'message_other_fields_test_' + util.generateIdAsString()

      const eventToSend = new Event(topic)
      for (let i = 0; i < otherFieldsCount; i++) {
        eventToSend.otherFields['key' + i] = 'value' + i
      }

      client.addEventCallback(topic, function (eventReceived) {
        client.shutdown(null, function () {
          for (let i = 0; i < otherFieldsCount; i++) {
            expect(eventReceived.otherFields['key' + i]).to.eql(
              eventToSend.otherFields['key' + i])
          }
          done()
        })
      })

      client.sendEvent(eventToSend)
    })
  })
})
