'use strict'

 // This sample demonstrates how to register a DXL service to receive Request
 // messages and send Response messages back to an invoking client.

var common = require('../common')
var dxl = common.require('@opendxl/dxl-client')

// The topic for the service to respond to
var SERVICE_TOPIC = '/isecg/sample/mybasicservice'

// Create DXL configuration from file
var config = dxl.Config.createDxlConfigFromFile(common.CONFIG_FILE)

// Create the client
var client = new dxl.Client(config)

// Connect to the fabric, supplying a callback function which is invoked
// when the connection has been established
client.connect(function () {
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
      // If an error did not occur, invoke the service (send a request)
      } else {
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
      }
    })
})
