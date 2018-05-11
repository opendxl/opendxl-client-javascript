'use strict'

var inherits = require('inherits')
var errorUtil = require('./error-util')

/**
 * @classdesc An exception raised when a URL related to a DXL broker is
 *   malformed.
 * @param {String} message - The error message.
 * @constructor
 */
function MalformedBrokerError (message) {
  errorUtil.initializeError(this, message)
}

inherits(MalformedBrokerError, Error)

module.exports = MalformedBrokerError
