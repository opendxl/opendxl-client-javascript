'use strict'

var MalformedBrokerError = require('./malformed_broker_error')
var util = require('./util')

var SSL_PORT = 8883
var SSL_PROTOCOL = 'ssl'

function portAsInteger (text) {
  try {
    return util.toPortNumber(text)
  } catch (err) {
    throw new MalformedBrokerError('Invalid broker port number: ' +
      err.message)
  }
}

function Broker (hosts, id, port) {
  this.hosts = (typeof hosts === 'string') ? [hosts] : hosts
  this.id = (typeof id === 'undefined') ? null : id
  this.port = (typeof port === 'undefined') ? SSL_PORT : portAsInteger(port)
}

Broker.parse = function (brokerUrl) {
  var hostName = brokerUrl
  var protocol = SSL_PROTOCOL
  var port = SSL_PORT

  var urlElements = brokerUrl.split('://')
  if (urlElements.length === 2) {
    protocol = urlElements[0]
    hostName = urlElements[1]
  }

  if (hostName.slice(-1) !== ']') {
    var hostNameParts = hostName.match(/(.*):(.*)/)
    if (hostNameParts) {
      hostName = hostNameParts[1]
      port = hostNameParts[2]
    }
  }

  if (protocol !== SSL_PROTOCOL) {
    throw new MalformedBrokerError('Unknown protocol: ' + protocol)
  }

  return new Broker(hostName.replace(/[[\]]/g, ''),
      util.generateIdAsString(), port)
}

module.exports = Broker
