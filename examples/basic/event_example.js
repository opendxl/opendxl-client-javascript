'use strict'

var common = require('../common.js')
var dxlConfig = require('../../lib/config')
var DxlClient = require('../../lib/client')
var Event = require('../../lib/event')

var EVENT_TOPIC = '/isecg/sample/basicevent'
var TOTAL_EVENTS = 1000

var config = dxlConfig.createDxlConfigFromFile(common.CONFIG_FILE)
var client = new DxlClient(config)

var eventCount = 0
var start = Date.now()

client.addEventCallback(EVENT_TOPIC,
  function (event) {
    console.log('Received event: ' + event.payload)
    eventCount += 1

    if (eventCount === TOTAL_EVENTS) {
      console.log('Elapsed time (ms): ' + (Date.now() - start))
      client.destroy()
    }
  })

client.connect(function () {
  for (var eventId = 0; eventId < TOTAL_EVENTS; eventId++) {
    var event = new Event(EVENT_TOPIC)
    event.payload = eventId.toString()
    client.sendEvent(event)
  }
  console.log('Waiting for events to be received...')
})
