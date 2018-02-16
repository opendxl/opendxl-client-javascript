'use strict'

var fs = require('fs')
var https = require('https')
var querystring = require('querystring')
var url = require('url')
var cliUtil = require('./cli-util')

var HTTP_MAX_REDIRECTS = 5

function ManagementService (hostName, port, userName, password,
                            trustStoreFile) {
  if (!userName) {
    throw new TypeError('User name is required for management service requests')
  }
  if (!password) {
    throw new TypeError('Password is required for management service requests')
  }
  this.hostName = hostName
  this.port = port
  this.auth = userName + ':' + password
  this.trustStoreFile = trustStoreFile
}

function buildQueryString (obj) {
  var query = Object.keys(obj).reduce(function (acc, key) {
    return acc + '&' + querystring.escape(key) + '=' +
      querystring.escape(obj[key])
  }, '')
  return query.replace(/^&/, '?')
}

function toUrlString (urlObject) {
  return 'https://' + urlObject.hostname + ':' + urlObject.port +
    '/' + urlObject.path
}

function httpGet (description, currentRedirects, requestOptions, queryString,
                  verbosity, responseCallback) {
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
        cliUtil.throwError('Reached maximum redirects for request to ' +
          requestUrl, description)
      } else {
        var redirectLocation = response.headers.location
        if (!redirectLocation) {
          cliUtil.throwError('Redirect with no location specified for ' +
            requestUrl, description)
        }

        var parsedRedirectLocation = url.parse(redirectLocation)
        if ((parsedRedirectLocation.hostname &&
            (parsedRedirectLocation.hostname !== requestOptions.hostname)) ||
          (parsedRedirectLocation.port &&
            (parsedRedirectLocation.port !== requestOptions.port))) {
          cliUtil.throwError('Redirect to different host or port not supported. ' +
            'Original URL: ' + requestUrl +
            '. Redirect URL: ' + redirectLocation + '.', description)
        }

        if (response.headers['set-cookie']) {
          if (!requestOptions.headers) {
            requestOptions.headers = {}
          }
          requestOptions.headers.cookie = response.headers['set-cookie']
        }

        requestOptions.path = response.headers.location
        httpGet(description, currentRedirects + 1, requestOptions,
          queryString, verbosity, responseCallback)
      }
      response.resume()
      return
    }
    response.on('data', function (chunk) {
      responseBody += chunk
    })
    response.on('end', function () {
      if (response.statusCode >= 200 && response.statusCode <= 299) {
        responseCallback(responseBody)
      } else {
        cliUtil.throwError('Request to ' + requestUrl +
          ' failed with HTTP error code: ' + response.statusCode +
          '. Reason: ' + response.statusMessage + '.', description)
      }
    })
  })
  request.on('error', function (error) {
    cliUtil.throwError('Error processing request to ' + requestUrl + ': ' + error,
      description)
  })
}

ManagementService.prototype.request = function (description, path, queryString,
                                                verbosity, responseCallback) {
  if (typeof queryString === 'undefined') {
    queryString = {}
  }
  queryString[':output'] = 'json'

  var requestOptions = {
    hostname: this.hostName,
    port: this.port,
    path: '/remote/' + path + buildQueryString(queryString),
    auth: this.auth
  }

  if (this.trustStoreFile) {
    if (!fs.existsSync(this.trustStoreFile)) {
      cliUtil.throwError('CA truststore file for HTTP requests not found: ' +
        this.trustStoreFile)
    }
    requestOptions.rejectUnauthorized = true
    requestOptions.requestCert = true
    requestOptions.ca = fs.readFileSync(this.trustStoreFile)
    // Bypass host name verification since broker certs typically are not
    // generated with actual hostnames in their Common Name or Subject
    // Alternative Name extensions.
    requestOptions.checkServerIdentity = function () {
      return undefined
    }
  } else {
    requestOptions.rejectUnauthorized = false
    requestOptions.requestCert = false
  }

  var requestUrl = toUrlString(requestOptions)

  httpGet(description, 0, requestOptions,
    queryString, verbosity, function (response) {
      if (verbosity > 1) {
        console.log('Response: ' + response)
      }
      var responseStatusDelimiter = response.indexOf(':')
      if (responseStatusDelimiter < 0) {
        cliUtil.throwError("Did not find ':' status delimiter in response body " +
          'for request to: ' + requestUrl, description)
      }
      var status = response.substring(0, responseStatusDelimiter).trim()
      var responseDetail = response.substring(
        responseStatusDelimiter + 1).trim()
      if (status !== 'OK') {
        cliUtil.throwError('Request to ' + requestUrl + ' failed with status ' +
          status + '. Message: ' + responseDetail, description)
      }
      responseCallback(JSON.parse(responseDetail))
    }
  )
}

module.exports = ManagementService
