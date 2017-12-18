'use strict'

var uuidv4 = require('uuid/v4')

module.exports = {
  _initializeError: function (obj, message) {
    Error.call(obj, message)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(obj, obj.constructor)
    }
    obj.name = obj.constructor.name
    obj.message = message
  },
  generateIdAsString: function () {
    return '{' + uuidv4() + '}'
  },
  toPortNumber: function (text) {
    var number = parseInt(text)
    if (isNaN(number)) {
      throw new TypeError("Port '" + text +
        "' cannot be converted into a number")
    }
    if (number < 1 || number > 65535) {
      throw new RangeError('Port number ' + text +
        ' not in valid range (1-65535)')
    }
    return number
  }
}
