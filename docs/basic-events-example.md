This sample demonstrates how to register a callback to receive
[Event](Event.html) messages from the DXL fabric. Once the callback is
registered, the sample sends a set number of [Event](Event.html) messages to
the fabric and waits for them all to be received by the callback.

Prior to running this sample make sure you have completed the
[client provisioning](https://github.com/opendxl/opendxl-client-javascript/wiki/Provisioning)
step.

### Running the Sample

To run this sample execute the ``examples/basic/event_example.js`` script as
follows:

```sh
$ node examples/basic/event_example.js
```

### Output

The output should appear similar to the following:

```
Waiting for events to be received...
Received event: 0
Received event: 1
Received event: 2
Received event: 3
Received event: 4
Received event: 5
...
Received event: 994
Received event: 995
Received event: 996
Received event: 997
Received event: 998
Received event: 999
Elapsed time (ms): 420
```
    
The code for the sample is broken into two main sections.

### Register Callback to Receive Events

The first section is responsible for registering an event callback for a
specific topic. The [addEventCallback](Client.html#addEventCallback) method of
the client will, by default, also subscribe to the topic.

```js
// Create and add event listener
client.addEventCallback(EVENT_TOPIC,
  function (event) {
    // Print the payload for the received event
    console.log('Received event: ' + event.payload)
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
```

### Send Events

The second section sends a set amount of Event messages via the
[sendEvent](Client.html#sendEvent) method of the client.

```js
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
```

The example waits for all of the events to be received by the event 
callback that was previously registered. After outputting the elapsed time,
the example calls the [destroy](Client.html#destroy) method of the client to
tear down client resources and end the example.
