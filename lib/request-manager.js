'use strict'

var ErrorResponse = require('./error-response')
var RequestError = require('./request-error')

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
  /**
   * The {@link Client} instance through which requests that this manager
   * tracks are made.
   * @type {Client}
   * @name RequestManager#_client
   * @private
   */
  this._client = client
  /**
   * The topic that the broker is expected to publish responses to for the
   * client.
   * @type {string}
   * @name RequestManager#_replyToTopic
   * @private
   */
  this.replyToTopic = replyToTopic
  /**
   * Object representing active requests. Each key contains the
   * {@link Message#messageId} of the request. Each corresponding value
   * contains the {@link Response} message received for the request, if one
   * has been received.
   * @type {Object}
   * @name RequestManager#_requests
   * @private
   */
  this._requests = {}
  client.addResponseCallback(replyToTopic, this.onResponse.bind(this), true)
}

/**
 * Performs an asynchronous request via the DXL fabric.
 * @param {Request} request - The request to perform.
 * @param {Function} [responseCallback=null] - The optional callback to be
 *   invoked when the response is received.
 */
RequestManager.prototype.asyncRequest = function (request, responseCallback) {
  this._requests[request.messageId] = responseCallback
  this._client._sendRequest(request)
}

/**
 * Invoked when a {@link Response} has been received. Delivers the response
 * to the corresponding request callback.
 * @param {Response} response - The response message.
 */
RequestManager.prototype.onResponse = function (response) {
  var responseCallback = this._requests[response.requestMessageId]
  if (responseCallback) {
    delete this._requests[response.requestMessageId]
    if (response instanceof ErrorResponse) {
      responseCallback(new RequestError(response), null)
    } else {
      responseCallback(null, response)
    }
  }
}

module.exports = RequestManager
