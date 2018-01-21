'use strict'

var ErrorResponse = require('../../lib/error-response')
var Response = require('../../lib/response')

/**
 * @classdesc Test service for integration testing
 * @param {Client} client - The client to which responses received should be
 *   delivered.
 * @constructor
 */
function TestService (client) {
  var that = this
  /**
   * Client to which responses received should be delivered.
   * @type {Client}
   * @name TestService#client
   */
  this.client = client
  /**
   * {@link ErrorResponse#errorCode} to deliver for an error response.
   * @default 99
   * @type {Number}
   * @name TestService#errorCode
   */
  this.errorCode = 99
  /**
   * {@link ErrorResponse#errorMessage} to deliver for an error response.
   * @default Error
   * @type {String}
   * @name TestService#errorMessage
   */
  this.errorMessage = 'Error'
  /**
   * Whether to return a successful {@link Response} (true) or
   * {@link ErrorResponse} (false) when a request is received.
   * @type {Boolean}
   * @name TestService#returnError
   */
  this.returnError = false
  /**
   * Response callback that should be invoked when requests are made to the
   * service. When invoked, this function sends either a {@link Response} or
   * {@link ErrorResponse} to the request per the value set for
   * {@link TestService#returnError}.
   * @param {Request} request - {@link Request} message received for the
   *   response.
   * @type {Function}
   * @name TestService#callback
   */
  this.callback = function (request) {
    var response
    if (that.returnError) {
      response = new ErrorResponse(request, that.errorCode, that.errorMessage)
    } else {
      response = new Response(request)
    }
    that.client.sendResponse(response)
  }
}

module.exports = TestService
