'use strict'

var inherits = require('inherits')
var util = require('./util')

/**
 * @classdesc An exception raised when a URL related to a DXL broker is
 *   malformed.
 * @param {String} message - The error message.
 * @constructor
 */
function MalformedBrokerError (message) {
  util.initializeError(this, message)
}

inherits(MalformedBrokerError, Error)

module.exports = MalformedBrokerError
