'use strict'

var common = require('../common.js')
var dxlConfig = require('../../lib/config')
var DxlClient = require('../../lib/client')
var MessageError = require('../../lib/message_error')
var Request = require('../../lib/request')
var Response = require('../../lib/response')
var ServiceRegistrationInfo = require('../../lib/service_registration_info')

var SERVICE_TOPIC = '/isecg/sample/mybasicservice'

var config = dxlConfig.createDxlConfigFromFile(common.CONFIG_FILE)
var client = new DxlClient(config)

client.connect(function () {
  var info = new ServiceRegistrationInfo('myService')
  info.addTopic(SERVICE_TOPIC,
    function (request) {
      console.log('Service received request payload: ' + request.payload)
      var response = new Response(request)
      response.payload = 'pong'
      client.sendResponse(response)
    })

  client.registerServiceAsync(info,
    function (error, response) {
      if (error) {
        client.destroy()
        console.log('Error registering service: ' + error.message)
        if (error instanceof MessageError) {
          console.log('Registration error code: ' + error.code)
        }
      } else {
        var request = new Request(SERVICE_TOPIC)
        request.payload = 'ping'
        client.asyncRequest(request,
          function (error, response) {
            client.destroy()
            if (error) {
              console.log('Request error: ' + error.message)
              if (error instanceof MessageError) {
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
