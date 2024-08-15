'use strict'

// This sample demonstrates how to register a callback to receive Event
// from the DXL fabric. Once the callback is registered, the sample sends a
// set number of Event messages to the fabric and waits for them all to be
// received by the callback.

const common = require('../common')
const dxl = common.require('@opendxl/dxl-client')

// The topic to publish to
const EVENT_TOPIC = '/isecg/sample/basicevent'

// The total number of events to send
const TOTAL_EVENTS = 1000

// Create DXL configuration from file
const config = dxl.Config.createDxlConfigFromFile(common.CONFIG_FILE)

// Create the client
const client = new dxl.Client(config)

// The number of events received
let eventCount = 0

// Record the start time
const start = Date.now()

// Create and add event listener
client.addEventCallback(EVENT_TOPIC,
  function (event) {
    // Print the payload for the received event. The toString() call converts
    // the payload from a binary Buffer into a string, decoded using UTF-8
    // character encoding.
    console.log('Received event: ' + event.payload.toString())
    // Increment the count
    eventCount++

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
  for (let eventId = 0; eventId < TOTAL_EVENTS; eventId++) {
    // Create the event
    const event = new dxl.Event(EVENT_TOPIC)
    // Set the payload
    event.payload = eventId.toString()
    // Send the event
    client.sendEvent(event)
  }
  console.log('Waiting for events to be received...')
})
