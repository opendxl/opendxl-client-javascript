'use strict'

var inherits = require('inherits')
var dxlUtil = require('../util')

/**
 * @classdesc An exception raised during processing of CLI-specific
 *   functionality.
 * @param {String} message - The error message.
 * @constructor
 */
function CliError (message) {
  dxlUtil.initializeError(this, message)
}

inherits(CliError, Error)

module.exports = CliError
