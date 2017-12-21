'use strict'

var common = require('../common')
var dxl = require('../../dxl-client')

var SERVICE_TOPIC = '/isecg/sample/mybasicservice'

var config = dxl.Config.createDxlConfigFromFile(common.CONFIG_FILE)
var client = new dxl.Client(config)

client.connect(function () {
  var info = new dxl.ServiceRegistrationInfo('myService')
  info.addTopic(SERVICE_TOPIC,
    function (request) {
      console.log('Service received request payload: ' + request.payload)
      var response = new dxl.Response(request)
      response.payload = 'pong'
      client.sendResponse(response)
    })

  client.registerServiceAsync(info,
    function (error) {
      if (error) {
        client.destroy()
        console.log('Error registering service: ' + error.message)
        if (error instanceof dxl.MessageError) {
          console.log('Registration error code: ' + error.code)
        }
      } else {
        var request = new dxl.Request(SERVICE_TOPIC)
        request.payload = 'ping'
        client.asyncRequest(request,
          function (error, response) {
            client.destroy()
            if (error) {
              console.log('Request error: ' + error.message)
              if (error instanceof dxl.MessageError) {
                console.log('Request error code: ' + error.code)
              }
            } else {
              console.log('Client received response payload: ' +
                response.payload)
            }
          })
      }
    })
})
