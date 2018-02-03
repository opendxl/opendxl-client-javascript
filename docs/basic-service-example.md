This sample demonstrates how to register a DXL service to receive
[Request](Request.html) messages and send [Response](Response.html) messages
back to an invoking [Client](Client.html).

Prior to running this sample make sure you have completed the
[client provisioning](https://github.com/opendxl/opendxl-client-javascript/wiki/Provisioning)
step.

### Running the Sample

To run this sample execute the ``examples/basic/service-example.js`` script as
follows:

```sh
$ node examples/basic/service-example.js
```

### Output

The output should appear similar to the following:

```sh
Service received request payload: ping
Client received response payload: pong
```

The code for the sample is broken into two main sections.

### Register service

The first section is responsible for creating a request callback that will be
invoked for a specific topic associated with the service. The callback will
send back a [Response](Response.html) message with a payload of "pong"
for any [Request](Request.html) messages that are received.

It then creates a [ServiceRegistrationInfo](ServiceRegistrationInfo.html)
instance and registers the request callback with the client via the
[addTopic](ServiceRegistrationInfo.html#addTopic) method.

Finally it registers the service with the fabric via the
[registerServiceAsync](Client.html#registerServiceAsync) method of the client.

```js
// Create service registration object
var info = new dxl.ServiceRegistrationInfo(client, 'myService')

// Add a topic for the service to respond to
info.addTopic(SERVICE_TOPIC,
  // Handle the receipt of an incoming service request
  function (request) {
    // Extract information from request.  The toString() call converts the
    // payload from a binary Buffer into a string, decoded using UTF-8
    // character encoding.
    console.log('Service received request payload: ' +
      request.payload.toString())
    // Create the response message
    var response = new dxl.Response(request)
    // Populate the response payload
    response.payload = 'pong'
    // Send the response
    client.sendResponse(response)
  })

// Register the service with the fabric
client.registerServiceAsync(info,
  function (error) {
    if (error) {
      // Destroy the client - frees up resources so that the application
      // stops running
      client.destroy()
      console.log('Error registering service: ' + error.message)
      // ...
    }
  })
```

### Invoke Service

After receiving notification of a successful registration of the service, the
second section sends a [Request](Request.html) message to the service that
contains a payload of "ping" via the [asyncRequest](Client.html#asyncRequest)
method of the client.

The payloads of the [Request](Request.html) and [Response](Response.html)
messages are printed.

```js
// Create the request message
var request = new dxl.Request(SERVICE_TOPIC)
// Populate the request payload
request.payload = 'ping'
// Send the request
client.asyncRequest(request,
  // Handle the response to the request
  function (error, response) {
    // Destroy the client - frees up resources so that the application
    // stops running
    client.destroy()
    // Display the contents of an error, if one occurred
    if (error) {
      console.log('Request error: ' + error.message)
      if (error instanceof dxl.MessageError) {
        console.log('Request error code: ' + error.code)
      }
    // No error occurred, so extract information from the response. The
    // toString() call converts the payload from a binary Buffer into a
    // string, decoded using UTF-8 character encoding.
    } else {
      console.log('Client received response payload: ' +
        response.payload.toString())
    }
  })
```
