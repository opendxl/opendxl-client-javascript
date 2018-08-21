'use strict'

var inherits = require('inherits')
var util = require('./util')

/**
 * @classdesc A general Data Exchange Layer (DXL) exception.
 * @param {String} message - The error message.
 * @augments Error
 * @constructor
 */
function DxlError (message) {
  util.initializeError(this, message)
}

inherits(DxlError, Error)

module.exports = DxlError
