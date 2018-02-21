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
/**
 * Default file mode to use for storing new files. Read-only for all but the
 * owner.
 * @type {Number}
 */
var _0644 = parseInt('0644', 8)
/**
 * Default file mode to use for creation of a directory. Read only (but
 * executable) for all but the owner.
 * @type {Number}
 */
var _0755 = parseInt('0755', 8)

/**
 * Returns a formatted error message string for use in log and exception
 * messages.
 * @param {String} message - The base message.
 * @param {String} component - Description of the system component in which
 *   the error occurred.
 * @param {String} header - Prefix to include before the error message.
 * @returns {String} The formatted error message.
 */
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
 * @param {Number} startPosition - Starting position (0-based) in the arguments
 *   array to process.
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
    callback(options)
  } else {
    var arg = args[startPosition]
    if (options[arg.name]) {
      fillEmptyOptionsFromPrompt(options, args, callback, startPosition + 1)
    } else {
      module.exports.getValueFromPrompt(arg.title || arg.name, arg.confirm,
        function (result) {
          options[arg.name] = result
          fillEmptyOptionsFromPrompt(options, args, callback, startPosition + 1)
        }
      )
    }
  }
}

module.exports = {
  /**
   * Default name of the DXL client configuration file to store.
   */
  DEFAULT_CONFIG_FILE_NAME: 'dxlclient.config',
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
   * Logs an error message to the console.
   * @param {String} message - The base message.
   * @param {String} component - Description of the system component in which
   *   the error occurred.
   * @param {String} header - Prefix to include before the error message.
   */
  logError: logError,
  /**
   * Convenience method for throwing a {@link CliError} with a formatted
   * error message.
   * @param {String} message - The base message.
   * @param {String} component - Description of the system component in which
   *   the error occurred.
   * @param {String} header - Prefix to include before the error message.
   * @throws {CliError}
   */
  throwError: throwError,
  /**
   * Creates a nested directory structure, if the supplied directory does not
   * already exist.
   * @param {String} dir - Directory to create.
   */
  mkdirRecursive: function (dir) {
    if (!fs.existsSync(dir)) {
      mkdirp.sync(dir, _0755)
    }
  },
  /**
   * Saves the supplied data into the specified file. This function attempts to
   * create the directory in which the file would reside if the directory does
   * not already exist.
   * @param {String} file - File to create.
   * @param {String} data - Data to store in the file.
   */
  saveToFile: function (file, data) {
    module.exports.mkdirRecursive(path.dirname(file))
    fs.writeFileSync(file, data, {mode: _0644})
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
        DEFAULT_MANAGEMENT_SERVICE_PORT)
      .option('-e, --truststore <truststore_file>',
        'name of file containing one or more CA pems to use in validating ' +
        'the management server')
  }
}
