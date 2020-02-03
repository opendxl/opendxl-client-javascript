'use strict'

var ErrorResponse = require('./error-response')

/**
 * @classdesc Multi-Service Response messages are aggregations of multiple
 *   {@link Response} messages. Multi-Service Response messages are
 *   collected and aggregated within the broker. Clients that are
 *   invoking the service (sending a request) will receive the response via
 *   the callback specified when invoking the {@link Client#asyncMultiServiceRequest}
 *   method.
 * @param {Response} initialResponse - The first {@link Response} message that the
 *   broker returned containing meta information.
 * @param {Number} expectedCount - The expected number of {@link Response} messages
 *   that the {@link Request} should receive.
 * @param {Response[]} responses - Array of the {@link Response} messages that have
 *   been received from services.
 * @constructor
 */
function MultiServiceResponse (initialResponse, expectedCount, responses) {
  /**
   * The initial {@link Response} from the broker containing the list of services
   * that will be invoked and the request IDs sent.
   * @type {Response}
   * @name MultiServiceResponse#initialResponse
   */
  this.initialResponse = initialResponse
  /**
   * Whether or not all invoked services returned a valid response. This will be
   * false if any of the invoked services returned an {@link ErrorResponse} or
   * failed to return anything within the timeout.
   * @type {Boolean}
   * @name MultiServiceResponse#success
   */
  this.success = false
  /**
   * The number of responses expected from this request.
   * @type {Number}
   * @name MultiServiceResponse#expectedCount
   */
  this.expectedCount = expectedCount
  /**
   * An array of the {@link Response} received for this request.
   * @type {Response[]}
   * @name MultiServiceResponse#responses
   */
  this.responses = responses

  if (responses) {
    let error = false
    this.responses.some(function (res) {
      error = res instanceof ErrorResponse
      return error
    })
    this.success = !(error || expectedCount !== responses.size)
  }
}

module.exports = MultiServiceResponse
