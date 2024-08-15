'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

const expect = require('chai').expect
const dxl = require('../..')
const Event = dxl.Event
const TestClient = require('./test-client')
const testHelpers = require('../test-helpers')

describe('callbacks subscribed with wildcard topics @integration', function () {
  it('should be invoked for a matching event', function (done) {
    const topic = 'wildcard_event_spec'
    const eventPayload = 'Unit test payload'

    const client = new TestClient(this, done)
    client.connect()
    client.addEventCallback(topic + '/#',
      function (event) {
        client.shutdown(null, function () {
          expect(testHelpers.decodePayload(event)).to.equal(eventPayload)
          done()
        })
      }
    )

    const event = new Event(topic + '/foo')
    event.payload = eventPayload
    client.sendEvent(event)
  })
})
