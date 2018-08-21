/**
 * @module ResponseErrorCode
 * @description Constants for error codes associated with a
 * {@link RequestError#code}.
 **/

'use strict'

module.exports = {
  /**
   * Error code returned by the broker when it is unable to locate a service
   * for a request
   */
  SERVICE_UNAVAILABLE: 'ERR_DXL_SERVICE_UNAVAILABLE',
  /**
   * Error code returned by the broker when it is overloaded.
   */
  SERVICE_OVERLOADED: 'ERR_DXL_SERVICE_OVERLOADED',
  /**
   * Error code returned in a response when a request timed out.
   */
  RESPONSE_TIMEOUT: 'ERR_DXL_RESPONSE_TIMEOUT'
}
