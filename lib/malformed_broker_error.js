'use strict'

var inherits = require('inherits')
var util = require('./util')

function MalformedBrokerError (message) {
  util._initializeError(this, message)
}

inherits(MalformedBrokerError, Error)

module.exports = MalformedBrokerError
