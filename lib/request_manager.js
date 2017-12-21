'use strict'

var ErrorResponse = require('./error_response')
var MessageError = require('./message_error')

function RequestManager (client, replyToTopic) {
  this.client = client
  this.replyToTopic = replyToTopic
  this.requests = {}
  client.addResponseCallback(replyToTopic, this.onResponse.bind(this), true)
}

RequestManager.prototype.asyncRequest = function (request, responseCallback) {
  this.requests[request.messageId] = responseCallback
  this.client._sendRequest(request)
}

RequestManager.prototype.onResponse = function (response) {
  var responseCallback = this.requests[response.requestMessageId]
  if (responseCallback) {
    delete this.requests[response.requestMessageId]
    if (response instanceof ErrorResponse) {
      responseCallback(new MessageError(response), null)
    } else {
      responseCallback(null, response)
    }
  }
}

module.exports = RequestManager
