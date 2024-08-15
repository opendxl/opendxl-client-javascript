'use strict'

const inherits = require('inherits')
const errorUtil = require('./error-util')

/**
 * @classdesc A general Data Exchange Layer (DXL) exception.
 * @param {String} message - The error message.
 * @augments Error
 * @constructor
 */
function DxlError (message) {
  errorUtil.initializeError(this, message)
}

inherits(DxlError, Error)

module.exports = DxlError
