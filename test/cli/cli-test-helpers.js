'use strict'

/** @module CliTestHelpers */

var fs = require('fs')
var program = require('commander')
var cli = require('../../lib/_cli')
var events = require('events')
var inherits = require('inherits')
var os = require('os')
var querystring = require('querystring')
var pki = require('../../lib/_cli/pki')

var CLI_OUTPUT_VERBOSITY = 0

function runOpenSslCommand (description, openSslCliArgs, input) {
  return pki.runOpenSslCommand(description, openSslCliArgs, null,
    CLI_OUTPUT_VERBOSITY, input).stdout.toString()
}

function HttpRequestStub () {
  events.EventEmitter.call(this)
}

inherits(HttpRequestStub, events.EventEmitter)

function HttpResponseStub (statusCode) {
  this.statusCode = statusCode || 404
  this.headers = {}
  this.resume = function () {}
  events.EventEmitter.call(this)
}

inherits(HttpResponseStub, events.EventEmitter)

module.exports = {
  LINE_SEPARATOR: os.platform() === 'win32' ? '\r\n' : '\n',
  cliCommand: function () {
    var command = new program.Command()
    command.verbose = CLI_OUTPUT_VERBOSITY
    if (!CLI_OUTPUT_VERBOSITY) {
      command.quiet = true
    }
    cli(command)
    return command
  },
  getCsrSubject: function (csrFileName) {
    var result = runOpenSslCommand('Getting csr subject', ['req', '-in',
      csrFileName, '-noout', '-subject'])
    var subject = result.match(/^subject=(.*)/)
    if (!subject) {
      throw new Error('Invalid subject format for csr (' + csrFileName + '): ' +
        result)
    }
    return subject[1]
  },
  getSubjectAlternativeNames: function (csrFileName) {
    var result = runOpenSslCommand('Getting csr subjAltNames', ['req', '-in',
      csrFileName, '-noout', '-text'])
    var subjectAltNameExtension = result.match(
      /X509v3 Subject Alternative Name:[^\n]*[\s]*([^\n]*)/)
    var subjectAltNames = []
    if (subjectAltNameExtension) {
      subjectAltNames = subjectAltNameExtension[1].split(', ')
    }
    return subjectAltNames
  },
  validateRsaPrivateKey: function (privateKeyFileName, input) {
    if (!fs.existsSync(privateKeyFileName)) {
      throw new Error('Cannot find private key file: ' + privateKeyFileName)
    }
    var privateKey = fs.readFileSync(privateKeyFileName)
    var checkArgs = ['rsa', '-in', privateKeyFileName, '-check']
    if (privateKey.indexOf('ENCRYPTED PRIVATE KEY-') > -1) {
      checkArgs.push('-passin')
      checkArgs.push('stdin')
    }
    var result = runOpenSslCommand('Checking private key', checkArgs,
      input || '')
    if (!result.match('RSA key ok') ||
      !result.match('-BEGIN RSA PRIVATE KEY-')) {
      throw new Error('Invalid RSA private key (' + privateKeyFileName + '): ' +
        result)
    }
  },
  createManagementServiceStub: function (requestStubs, cookie) {
    if (typeof cookie === 'undefined') {
      cookie = 'omnomnom'
    }
    return function (requestOptions, responseCallback) {
      var response = new HttpResponseStub()
      var responseData = ''
      if (requestOptions.headers && requestOptions.headers.cookie) {
        if (requestOptions.headers.cookie === cookie) {
          var pathMatch = requestOptions.path.match(/(.*)\?/)
          if (pathMatch && requestStubs[pathMatch[1]]) {
            response.statusCode = 200
            responseData = 'OK:\r\n' + JSON.stringify(
              requestStubs[pathMatch[1]](requestOptions))
            responseCallback(response)
          } else {
            response.statusCode = 404
            responseData = 'Unknown request path: ' + pathMatch[1]
          }
        } else {
          response.statusCode = 500
          responseCallback(response)
          response.emit('data', 'Unexpected cookie received in request: ' +
            requestOptions.headers.cookie)
        }
      } else {
        response.statusCode = 302
        var nextPath = requestOptions.path.match(/login\?next=(.*)/)
        if (nextPath) {
          response.headers['set-cookie'] = cookie
          response.headers.location = querystring.unescape(nextPath[1])
        } else {
          response.headers.location = '/login?next=' +
            querystring.escape(requestOptions.path)
        }
        responseCallback(response)
      }
      response.emit('data', responseData)
      response.emit('end')
      return new HttpRequestStub()
    }
  }
}
