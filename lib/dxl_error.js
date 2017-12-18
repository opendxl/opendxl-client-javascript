'use strict'

var inherits = require('inherits')
var util = require('./util')

function DxlError (message) {
  util._initializeError(this, message)
}

inherits(DxlError, Error)

module.exports = DxlError
