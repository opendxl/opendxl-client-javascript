'use strict'

function _RequestManager (client, replyToTopic) {
  this.client = client
  this.replyToTopic = replyToTopic
  this.requests = {}
  client.addResponseCallback(replyToTopic, this.onResponse.bind(this), true)
}

_RequestManager.prototype.asyncRequest = function (request, responseCallback) {
  this.requests[request.messageId] = responseCallback
  this.client._sendRequest(request)
}

_RequestManager.prototype.onResponse = function (response) {
  var responseCallback = this.requests[response.requestMessageId]
  if (responseCallback) {
    delete this.requests[response.requestMessageId]
    responseCallback(response)
  }
}

module.exports = _RequestManager
