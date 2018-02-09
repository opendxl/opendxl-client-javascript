'use strict'

var inherits = require('inherits')
var util = require('../util')

/**
 * @classdesc An exception raised during processing of CLI-specific
 *   functionality.
 * @param {String} message - The error message.
 * @constructor
 */
function CliError (message) {
  util.initializeError(this, message)
}

inherits(CliError, Error)

module.exports = CliError
