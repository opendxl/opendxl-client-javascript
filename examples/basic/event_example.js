'use strict'

 // This sample demonstrates how to register a callback to receive Event
 // from the DXL fabric. Once the callback is registered, the sample sends a
 // set number of Event messages to the fabric and waits for them all to be
 // received by the callback.

var common = require('../common')
var dxl = require('../../dxl-client')

// The topic to publish to
var EVENT_TOPIC = '/isecg/sample/basicevent'

// The total number of events to send
var TOTAL_EVENTS = 1000

// Create DXL configuration from file
var config = dxl.Config.createDxlConfigFromFile(common.CONFIG_FILE)

// Create the client
var client = new dxl.Client(config)

// The number of events received
var eventCount = 0

// Record the start time
var start = Date.now()

// Create and add event listener
client.addEventCallback(EVENT_TOPIC,
  function (event) {
    // Print the payload for the received event
    console.log('Received event: ' + event.payload)
    // Increment the count
    eventCount += 1

    // Wait until all events have been received
    if (eventCount === TOTAL_EVENTS) {
      console.log('Elapsed time (ms): ' + (Date.now() - start))
      // Destroy the client - frees up resources so that the application
      // stops running
      client.destroy()
    }
  })

// Connect to the fabric, supplying a callback function which is invoked
// when the connection has been established
client.connect(function () {
  // Loop and send the events
  for (var eventId = 0; eventId < TOTAL_EVENTS; eventId++) {
    // Create the event
    var event = new dxl.Event(EVENT_TOPIC)
    // Set the payload
    event.payload = eventId.toString()
    // Send the event
    client.sendEvent(event)
  }
  console.log('Waiting for events to be received...')
})
