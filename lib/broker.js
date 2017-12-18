'use strict'

var MalformedBrokerError = require('./malformed_broker_error')
var util = require('./util')

var SSL_PORT = 8883

function portAsInteger (text) {
  try {
    return util.toPortNumber(text)
  } catch (err) {
    throw new MalformedBrokerError('Invalid broker port number: ' +
      err.message)
  }
}

function Broker (hosts, id, port) {
  this.hosts = hosts
  this.id = (typeof (id) === 'undefined') ? null : id
  this.port = (typeof (port) === 'undefined') ? SSL_PORT : portAsInteger(port)
}

module.exports = Broker
