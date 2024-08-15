'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

const expect = require('chai').expect
const Event = require('../..').Event
const util = require('../../lib/util')
const TestClient = require('./test-client')

describe('event callbacks @integration', function () {
  it('should be received for every event request made', function (done) {
    const sendCount = 10000
    let receiveCount = 0
    const events = []

    const client = new TestClient(this, done)
    client.connect(function () {
      const topic = 'event_request_test_' + util.generateIdAsString()

      client.addEventCallback(topic, function (event) {
        const eventPosition = events.indexOf(event.messageId)
        if (eventPosition >= 0) {
          events.splice(eventPosition, 1)
          receiveCount++
          if (receiveCount === sendCount) {
            client.shutdown(null, function () {
              expect(events.length).to.equal(0)
              done()
            })
          }
        }
      })

      for (let i = 0; i < sendCount; i++) {
        const event = new Event(topic)
        events.push(event.messageId)
        client.sendEvent(event)
      }
    })
  })
})
