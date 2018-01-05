'use strict'

var ErrorResponse = require('./error_response')
var MessageError = require('./message_error')

/**
 * @classdesc Manager that tracks outstanding requests and notifies the
 *   appropriate parties (invoking a response callback, notifying a waiting
 *   object, etc.) when a corresponding response is received.
 *
 *   This purpose of this object is to collaborate with a {@link Client}
 *   instance.
 * @private
 * @param {Client} client - The {@link Client} instance through which requests
 *   that this manager tracks are made.
 * @param {String} replyToTopic - The topic that the broker is expected to
 *   publish responses to for the client.
 * @constructor
 */
function RequestManager (client, replyToTopic) {
  this.client = client
  this.replyToTopic = replyToTopic
  this.requests = {}
  client.addResponseCallback(replyToTopic, this.onResponse.bind(this), true)
}

/**
 * Performs an asynchronous request via the DXL fabric.
 * @param {Request} request - The request to perform.
 * @param {Function} [responseCallback=null] - The optional callback to be
 *   invoked when the response is received.
 */
RequestManager.prototype.asyncRequest = function (request, responseCallback) {
  this.requests[request.messageId] = responseCallback
  this.client._sendRequest(request)
}

/**
 * Invoked when a {@link Response} has been received. Delivers the response
 * to the corresponding request callback.
 * @param {Response} response - The response message.
 */
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
