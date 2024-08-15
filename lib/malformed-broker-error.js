'use strict'

const inherits = require('inherits')
const errorUtil = require('./error-util')

/**
 * @classdesc An exception raised when a URL related to a DXL broker is
 *   malformed.
 * @param {String} message - The error message.
 * @augments Error
 * @constructor
 */
function MalformedBrokerError (message) {
  errorUtil.initializeError(this, message)
}

inherits(MalformedBrokerError, Error)

module.exports = MalformedBrokerError
