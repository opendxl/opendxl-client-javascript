'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var expect = require('chai').expect
var dxl = require('../../dxl-client')
var Event = dxl.Event
var TestClient = require('./test-client')
var testHelpers = require('../test-helpers')

describe('callbacks subscribed with wildcard topics @integration', function () {
  it('should be invoked for a matching event', function (done) {
    var topic = 'wildcard_event_spec'
    var eventPayload = 'Unit test payload'

    var client = new TestClient(this, done)
    client.connect()
    client.addEventCallback(topic + '/#',
      function (event) {
        client.shutdown(null, function () {
          expect(testHelpers.decodePayload(event)).to.equal(eventPayload)
          done()
        })
      }
    )

    var event = new Event(topic + '/foo')
    event.payload = eventPayload
    client.sendEvent(event)
  })
})
