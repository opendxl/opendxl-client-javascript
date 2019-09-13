'use strict'

var fs = require('fs')
var https = require('https')
var querystring = require('querystring')
var url = require('url')
var provisionUtil = require('./provision-util')
var HttpsProxyAgent = require('https-proxy-agent')

var HTTP_MAX_REDIRECTS = 5

/**
 * Host info for the management service
 * @typedef {Object} ManagementServiceHostInfo
 * @property {String} hostname - Name of the host where the management
 *   service resides.
 * @property {String} user - Username to run remote commands as.
 * @property {String} password - Password for the management service user.
 * @property {String} [port=8443] - Port at which the management service
 *   resides.
 * @property {String} [truststore] - Location of a file of CA certificates
 *   to use when verifying the management service's certificate. If no value is
 *   specified, no validation of the management service's certificate is
 *   performed.
 * @private
 */

/**
 * @classdesc Handles REST invocation of a management service.
 * @param {ManagementServiceHostInfo} hostInfo - Options for the management
 *   service host.
 * @constructor
 * @private
*/
function ManagementService (hostInfo) {
  if (!hostInfo.hostname) {
    throw new TypeError('Hostname is required for management service requests')
  }
  if (!hostInfo.user) {
    throw new TypeError('User name is required for management service requests')
  }
  if (!hostInfo.password) {
    throw new TypeError('Password is required for management service requests')
  }
  this.hostname = hostInfo.hostname
  this.port = hostInfo.port || ManagementService.DEFAULT_PORT
  this.auth = hostInfo.user + ':' + hostInfo.password
  this.trustStoreFile = hostInfo.truststore
}

/**
 * Default port number at which the management service REST API is assumed to
 * be hosted.
 * @type {string}
 */
ManagementService.DEFAULT_PORT = '8443'

/**
 * Flattens the key / value pairs in the supplied object into a query string
 * for use in an HTTP request.
 * @param {Object} obj - Object containing the key/value pairs to convert into
 *   a query string.
 * @returns {String} The query string.
 * @private
 */
function buildQueryString (obj) {
  var query = Object.keys(obj).reduce(function (acc, key) {
    return acc + '&' + querystring.escape(key) + '=' +
      querystring.escape(obj[key])
  }, '')
  return query.replace(/^&/, '?')
}

/**
 * Converts the supplied URL object into a fully-qualified URL string.
 * @param {Object} urlObject - Object containing URL components.
 * @param {String} urlObject.hostname - The URL host name
 * @param {String} urlObject.port - The URL port
 * @param {String} urlObject.path - The URL path
 * @returns {String} The URL string
 * @private
 */
function toUrlString (urlObject) {
  return 'https://' + urlObject.hostname + ':' + urlObject.port + urlObject.path
}

/**
 * Performs an HTTP get to the management service. The response received from
 * the service is supplied as an argument to the responseCallback function.
 * @param {String} description - Textual description of the HTTP request (used
 *   in log and error messages).
 * @param {Number} currentRedirects - Number of HTTP redirects which have been
 *   followed thus far for this request.
 * @param {Object} requestOptions - Request options to pass along to the
 *   underlying HTTP request library.
 * @param {Number} verbosity - Level of verbosity at which to log any error
 *   or trace messages.
 * @param {Function} responseCallback - Function to invoke with the response
 *   body received from the management service. If an error occurs during
 *   request processing, the first parameter delivered to the callback
 *   includes the associated `Error` instance. If the request is successful,
 *   the response body is provided in the second parameter (as an object
 *   parsed from the response JSON).
 * @private
 */
function httpGet (description, currentRedirects, requestOptions, verbosity,
                  responseCallback) {
  var requestUrl = toUrlString(requestOptions)
  var responseBody = ''

  if (verbosity > 1) {
    console.log('HTTP request to: ' + requestUrl)
  }

  var request = https.get(requestOptions, function (response) {
    if (verbosity > 1) {
      console.log('HTTP response status code: ' + response.statusCode)
    }
    if (response.statusCode === 302) {
      if (currentRedirects === HTTP_MAX_REDIRECTS) {
        responseCallback(provisionUtil.createFormattedDxlError(
          'Reached maximum redirects for request to ' + requestUrl, description)
        )
      } else {
        var redirectLocation = response.headers.location
        if (!redirectLocation) {
          responseCallback(provisionUtil.createFormattedDxlError(
            'Redirect with no location specified for ' +
            requestUrl, description))
          return
        }
        if (verbosity > 1) {
          console.log('HTTP response redirect to: ' + redirectLocation)
        }

        var parsedRedirectLocation = url.parse(redirectLocation)
        if ((parsedRedirectLocation.hostname &&
            (parsedRedirectLocation.hostname !== requestOptions.hostname)) ||
          (parsedRedirectLocation.port &&
            (parsedRedirectLocation.port !== requestOptions.port))) {
          responseCallback(provisionUtil.createFormattedDxlError(
              'Redirect to different host or port not supported. ' +
              'Original URL: ' + requestUrl +
              '. Redirect URL: ' + redirectLocation + '.', description))
          return
        }

        if (response.headers['set-cookie']) {
          if (!requestOptions.headers) {
            requestOptions.headers = {}
          }
          requestOptions.headers.cookie = response.headers['set-cookie']
        }

        requestOptions.path = response.headers.location
        httpGet(description, currentRedirects + 1, requestOptions, verbosity,
          responseCallback)
        response.resume()
        return
      }
    }
    response.on('data', function (chunk) {
      responseBody += chunk
    })
    response.on('end', function () {
      if (response.statusCode >= 200 && response.statusCode <= 299) {
        responseCallback(null, responseBody)
      } else {
        responseCallback(provisionUtil.createFormattedDxlError(
            'Request to ' + requestUrl +
            ' failed with HTTP error code: ' + response.statusCode +
            '. Reason: ' + response.statusMessage + '.', description))
      }
    })
  })
  request.on('error', function (error) {
    responseCallback(provisionUtil.createFormattedDxlError(
        'Error processing request to ' + requestUrl + ': ' + error,
        description))
  })
}

/**
 * Sends a request to the management service.
 * @param {String} description - Textual description of the HTTP request (used
 *   in log and error messages).
 * @param {String} path - URL path to the management service resource to query.
 * @param {Object} queryString - HTTP query string, as an object whose
 *   properties are the string's fields, to append to management service
 *   requests.
 * @param {Number} verbosity - Level of verbosity at which to log any error
 *   or trace messages.
 * @param {Function} responseCallback - Function to invoke with the response
 *   body received from the management service. If an error occurs during
 *   request processing, the first parameter delivered to the callback
 *   includes the associated `Error` instance. If the request is successful,
 *   the response body is provided in the second parameter (decoded from JSON).
 */
ManagementService.prototype.request = function (description, path, queryString,
                                                verbosity, responseCallback) {
  if (typeof queryString === 'undefined') {
    queryString = {}
  }
  queryString[':output'] = 'json'

  var requestOptions = {
    hostname: this.hostname,
    port: this.port,
    path: '/remote/' + path + buildQueryString(queryString),
    auth: this.auth
  }

  if (this.trustStoreFile) {
    if (!fs.existsSync(this.trustStoreFile)) {
      responseCallback(provisionUtil.createFormattedDxlError(
          'CA truststore file for HTTP requests not found: ' +
          this.trustStoreFile))
      return
    }
    requestOptions.rejectUnauthorized = true
    requestOptions.requestCert = true
    requestOptions.ca = fs.readFileSync(this.trustStoreFile)
    // Bypass host name verification since broker certs typically are not
    // generated with actual host names in their Common Name or Subject
    // Alternative Name extensions.
    requestOptions.checkServerIdentity = function () {
      return undefined
    }
  } else {
    requestOptions.rejectUnauthorized = false
    requestOptions.requestCert = false
  }

  // use proxy specified in the env
  var proxy
  if (process.env.http_proxy != null) { proxy = process.env.http_proxy }
  if (process.env.HTTP_PROXY != null) { proxy = process.env.HTTP_PROXY }

  if (proxy) {
    // if there is no protocol set in the env variable add the http://
    proxy = (proxy.indexOf('://') === -1) ? 'http://' + proxy : proxy
    var proxyOptions = url.parse(proxy)
    proxyOptions.secureEndpoint = true
    console.log('Connecting via Proxy:', proxy)
    // set proxy agent in requestOptions
    requestOptions.agent = new HttpsProxyAgent(proxyOptions)
  }

  var requestUrl = toUrlString(requestOptions)

  httpGet(description, 0, requestOptions, verbosity,
    function (error, response) {
      var responseObj
      if (response) {
        if (verbosity > 1) {
          console.log('Response: ' + response)
        }
        var responseStatusDelimiter = response.indexOf(':')
        if (responseStatusDelimiter < 0) {
          error = provisionUtil.createFormattedDxlError(
            "Did not find ':' status delimiter in response body " +
            'for request to: ' + requestUrl, description)
        } else {
          var status = response.substring(0, responseStatusDelimiter).trim()
          var responseDetail = response.substring(
            responseStatusDelimiter + 1).trim()
          if (status === 'OK') {
            try {
              responseObj = JSON.parse(responseDetail)
            } catch (parseError) {
              error = provisionUtil.createFormattedDxlError(
                'Request to ' + requestUrl + ' returned invalid JSON.' +
                ' Message: ' + parseError)
            }
          } else {
            error = provisionUtil.createFormattedDxlError(
              'Request to ' + requestUrl + ' failed with status ' +
              status + '. Message: ' + responseDetail, description)
          }
        }
      } else if (!error) {
        error = provisionUtil.createFormattedDxlError(
          'Request to ' + requestUrl + ' returned empty response',
          description)
      }
      responseCallback(error, responseObj)
    }
  )
}

module.exports = ManagementService
