'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var expect = require('chai').expect
var Event = require('../../lib/event')
var util = require('../../lib/util')
var TestClient = require('./test-client')

describe('event callbacks @integration', function () {
  it('should be received for every event request made', function (done) {
    var sendCount = 10000
    var receiveCount = 0
    var events = []

    var client = new TestClient(this, done)
    client.connect(function () {
      var topic = 'event_request_test_' + util.generateIdAsString()

      client.addEventCallback(topic, function (event) {
        var eventPosition = events.indexOf(event.messageId)
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

      for (var i = 0; i < sendCount; i++) {
        var event = new Event(topic)
        events.push(event.messageId)
        client.sendEvent(event)
      }
    })
  })
})
