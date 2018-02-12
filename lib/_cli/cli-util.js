'use strict'

/**
 * @module CliUtil
 * @private
 */

var fs = require('fs')
var mkdirp = require('mkdirp')
var path = require('path')
var read = require('read')
var CliError = require('./cli-error')

var DEFAULT_MANAGEMENT_SERVICE_PORT = '8443'
var _0644 = parseInt('0644', 8)
var _0755 = parseInt('0755', 8)

function getErrorMessage (message, component, header) {
  if (typeof header === 'undefined') {
    header = ''
  }
  if (component) {
    if (header) {
      header += ' '
    }
    header += '('
    header += component
    header += ')'
  }
  if (header) {
    message = header + ': ' + message
  }
  return message
}

function logError (message, component, header) {
  message = getErrorMessage(message, component, header)
  if (typeof header === 'undefined') {
    message = 'ERROR: ' + message
  }
  console.error(message)
}

function throwError (message, component, header) {
  throw new CliError(getErrorMessage(message, component, header))
}

module.exports = {
  DEFAULT_CONFIG_FILE_NAME: 'dxlclient.config',
  getProgramVerbosity: function (program) {
    var verbosity = program.verbose
    if (program.quiet) {
      verbosity = 0
    } else if (typeof verbosity === 'undefined') {
      verbosity = 1
    }
    return verbosity
  },
  addProgramArgsToAction: function (program, action) {
    return function () {
      Array.prototype.push.call(arguments,
        module.exports.getProgramVerbosity(program))
      action.apply(null, arguments)
    }
  },
  logError: logError,
  throwError: throwError,
  mkdirRecursive: function (dir) {
    if (!fs.existsSync(dir)) {
      mkdirp.sync(dir, _0755)
    }
  },
  saveToFile: function (file, data) {
    module.exports.mkdirRecursive(path.dirname(file))
    fs.writeFileSync(file, data, {mode: _0644})
  },
  getValueFromPrompt: function (title, confirm, callback) {
    var fullTitle = title.indexOf('Confirm') === 0 ? title : 'Enter ' + title
    fullTitle += ':'
    read({
      prompt: fullTitle,
      silent: true
    }, function (error, result) {
      if (error) {
        console.log()
        throwError('Error obtaining value for prompt: ' + title)
      }
      if (result) {
        if (confirm) {
          module.exports.getValueFromPrompt('Confirm ' + title, false,
            function (confirmationResult) {
              if (result === confirmationResult) {
                callback(result)
              } else {
                console.log('Values for ' + title + ' do not match. Try again.')
                module.exports.getValueFromPrompt(title, true, callback)
              }
            }
          )
        } else {
          callback(result)
        }
      } else {
        console.log('Value cannot be empty. Try again.')
        module.exports.getValueFromPrompt(title, confirm, callback)
      }
    })
  },
  fillEmptyArgsFromPrompt: function (options, args, callback, startPosition) {
    if (typeof startPosition === 'undefined') {
      startPosition = 0
    }
    if (startPosition < 0) {
      throw new RangeError('Start position must not be negative')
    }
    if (startPosition > args.length) {
      throw new RangeError('Start position (' + startPosition +
        ') is greater than length of args (' + args.length + ')')
    }
    if (startPosition === args.length) {
      callback(options)
    } else {
      var arg = args[startPosition]
      if (options[arg.name]) {
        module.exports.fillEmptyArgsFromPrompt(options, args, callback,
          startPosition + 1)
      } else {
        module.exports.getValueFromPrompt(arg.title || arg.name, arg.confirm,
          function (result) {
            options[arg.name] = result
            module.exports.fillEmptyArgsFromPrompt(options, args, callback,
              startPosition + 1)
          }
        )
      }
    }
  },
  fillEmptyServerCredentialsFromPrompt: function (options, callback) {
    module.exports.fillEmptyArgsFromPrompt(options, [
      {name: 'user', title: 'server user'},
      {name: 'password', title: 'server password'}
    ], callback)
  },
  appendManagementServiceCommandOptions: function (command) {
    return command
      .option('-u, --user <username>',
        'user registered at the management service')
      .option('-p, --password <password>', 'password for the management user')
      .option('-t, --port <port>', 'password for the management user',
        DEFAULT_MANAGEMENT_SERVICE_PORT)
  }
}
