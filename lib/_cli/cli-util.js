/**
 * @module CliUtil
 * @private
 */

'use strict'

var read = require('read')
var provisionUtil = require('../_provisioning/provision-util')
var ManagementService = require('../_provisioning/management-service')

/**
 * For each arg in the args object, check to see if a corresponding non-empty
 * value is set in the options object. For any unset value, prompt the user
 * on the console for a value to set into the options object. Argument input
 * is processed asynchronously, with a call made to the function specified in
 * the callback argument after all arguments have been processed.
 * @param {Object} options - Object whose values should be non-empty for each
 *   name in the corresponding args object.
 * @param {Array<Object>} args - Info for the key to check in the options
 *   object.
 * @param {String} args.name - Name to match to a key in the options object.
 * @param {String} args.title - Title to display to the user when prompting
 *   for a value to store in the options object.
 * @param {Boolean} [args.confirm=false] - Whether or not the user should be
 *   prompted to enter the value twice for an option - to confirm the original
 *   value.
 * @param {Function} callback - Function to invoke after all arguments have
 *   been processed.
 * @param {Number} [startPosition=0] - Starting position (0-based) in the
 *   arguments array to process.
 */
function fillEmptyOptionsFromPrompt (options, args, callback, startPosition) {
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
    callback(null, options)
  } else {
    var arg = args[startPosition]
    if (options[arg.name]) {
      fillEmptyOptionsFromPrompt(options, args, callback, startPosition + 1)
    } else {
      module.exports.getValueFromPrompt(arg.title || arg.name, arg.confirm,
        function (error, result) {
          if (error) {
            callback(error)
          } else {
            options[arg.name] = result
            fillEmptyOptionsFromPrompt(options, args, callback, startPosition + 1)
          }
        }
      )
    }
  }
}

module.exports = {
  /**
   * Determines the logging verbosity for the specified Commander program
   * object.
   * @param {Program} program - Commander program / command.
   * @returns {Number} Verbosity level where 0 = silence to N = most verbose.
   */
  getProgramVerbosity: function (program) {
    var verbosity = program.verbose
    if (program.quiet) {
      verbosity = 0
    } else if (typeof verbosity === 'undefined') {
      verbosity = 1
    }
    return verbosity
  },
  /**
   * Reads a value from standard input. The characters entered by the user
   * are not echoed to the console.
   * @param {String} title - Prompt string title to display.
   * @param {Boolean} confirm - Whether or not to prompt the user to enter the
   *   value a second time before using it. This could be used for validating
   *   the user's selection for sensitive values like passwords.
   * @param {Function} callback - Callback function to invoke with the value
   *   entered by the user.
   */
  getValueFromPrompt: function (title, confirm, callback) {
    var fullTitle = title.indexOf('Confirm') === 0 ? title : 'Enter ' + title
    fullTitle += ':'
    read({
      prompt: fullTitle,
      silent: true
    }, function (error, result) {
      if (error) {
        process.stdout.write('\n')
        callback(provisionUtil.createFormattedDxlError(
          'Error obtaining value for prompt: ' + title))
      } else if (result) {
        if (confirm) {
          module.exports.getValueFromPrompt('Confirm ' + title, false,
            function (error, confirmationResult) {
              if (error) {
                process.stdout.write('\n')
                callback(provisionUtil.createFormattedDxlError(
                  'Error obtaining confirmation value for prompt: ' + title))
              } else if (result === confirmationResult) {
                callback(null, result)
              } else {
                process.stdout.write('Values for ' + title +
                  ' do not match. Try again.\n')
                module.exports.getValueFromPrompt(title, true, callback)
              }
            }
          )
        } else {
          callback(null, result)
        }
      } else {
        process.stdout.write('Value cannot be empty. Try again.\n')
        module.exports.getValueFromPrompt(title, confirm, callback)
      }
    })
  },
  /**
   * Checks the values for server credentials properties in an options object.
   * For any empty values, prompt the user at the console for a value to set
   * back into the options object. Argument input is processed asynchronously,
   * with a call made to the function specified in the callback argument after
   * all arguments have been processed.
   * @param {Object} options - Object whose values should be non-empty for each
   *   name in the corresponding args object.
   * @param {Function} callback - Function to invoke after all arguments have
   *   been processed.
   */
  fillEmptyServerCredentialsFromPrompt: function (options, callback) {
    fillEmptyOptionsFromPrompt(options, [
      {name: 'user', title: 'server user'},
      {name: 'password', title: 'server password'}
    ], callback)
  },
  /**
   * Appends options related to the use of the management service to a
   * Commander-based command.
   * @param {Command} command - The Commander command to append options onto.
   * @returns {Command} The original command parameter, with the additional
   *   options appended.
   */
  appendManagementServiceCommandOptions: function (command) {
    return command
      .option('-u, --user <username>',
        'user registered at the management service')
      .option('-p, --password <password>', 'password for the management user')
      .option('-t, --port <port>', 'password for the management user',
        ManagementService.DEFAULT_PORT)
      .option('-e, --truststore <truststore_file>',
        'name of file containing one or more CA pems to use in validating ' +
        'the management server')
  },
  /**
   * Extract host info from the supplied Commander-based command. Host-info
   * keys are removed from the command.
   * @param {String} hostname - Name of the management service host.
   * @param {Command} command - The Commander command to extract host info
   *   from.
   * @returns {ManagementServiceHostInfo} The host info.
   */
  pullHostInfoFromCommand: function (hostname, command) {
    var hostInfo = {hostname: hostname, user: '', password: ''}
    var hostInfoKeys = ['port', 'user', 'password', 'truststore']
    hostInfoKeys.forEach(function (hostInfoKey) {
      if (command[hostInfoKey]) {
        hostInfo[hostInfoKey] = command[hostInfoKey]
        delete command[hostInfoKey]
      }
    })
    return hostInfo
  }
}
