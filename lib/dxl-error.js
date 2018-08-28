'use strict'

var inherits = require('inherits')
var errorUtil = require('./error-util')

/**
 * @classdesc A general Data Exchange Layer (DXL) exception.
 * @param {String} message - The error message.
 * @constructor
 */
function DxlError (message) {
  errorUtil.initializeError(this, message)
}

inherits(DxlError, Error)

module.exports = DxlError
