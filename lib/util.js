'use strict'
var uuidv4 = require('uuid/v4')

function generateIdAsString () {
  return '{' + uuidv4() + '}'
}

module.exports.generateIdAsString = generateIdAsString
