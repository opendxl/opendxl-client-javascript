var DxlClient = require('../../lib/client')
var message = require('../../lib/message')
var Request = require('../../lib/request')
var Response = require('../../lib/response')
var ServiceRegistrationInfo = require('../../lib/service_registration_info')

const SERVICE_TOPIC = '/isecg/sample/mybasicservice'

var client = new DxlClient()

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
    function (response) {
      if (response.messageType === message.MESSAGE_TYPE_ERROR) {
        client.destroy()
        console.log('Error registering service: ' + response.errorMessage +
          ' ' + response.errorCode)
      } else {
        var request = new Request(SERVICE_TOPIC)
        request.payload = 'ping'
        client.asyncRequest(request,
          function (response) {
            client.destroy()
            if (response.messageType === message.MESSAGE_TYPE_ERROR) {
              console.log('Request error: ' + response.errorMessage + ' ' +
                response.errorCode)
            } else {
              console.log('Client received response payload: ' +
                response.payload)
            }
          })
      }
    })
})
