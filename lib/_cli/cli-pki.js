/**
 * @module CliPki
 * @description Helpers for processing PKI-related options specified when
 * using the cli tools.
 * @private
 */

'use strict'

const pki = require('../_provisioning/pki')
const cliUtil = require('./cli-util')
const provisionUtil = require('../_provisioning/provision-util')

/**
 * Converts a camelCase field name to lowercase hyphen-delimited format for
 * use as a command-line option. For example, this method would convert
 * 'optionName' to 'option-name'.
 * @param {String} field - Name of the field to convert.
 * @returns {String} Field name in lowercase hyphen-delimited format.
 */
function fieldAsOption (field) {
  let option = ''
  for (let i = 0; i < field.length; i++) {
    const c = field.charAt(i)
    if (c < 'a') {
      option = option + '-' + c.toLowerCase()
    } else {
      option += c
    }
  }
  return option
}

/**
 * Function used by a Commander command to append a subject alternative name
 * to the list of names specified on the command line.
 * @param {String} san - Subject alternative name to add to the list.
 * @param {Array<String>} sans - List of subject alternative names to append
 *   the san parameter to.
 * @returns {Array<String>} The sans parameter, with the san parameter appended.
 */
function sanOption (san, sans) {
  sans.push(san)
  return sans
}

module.exports = {
  /**
   * Appends options related to the use of PKI utilities to a Commander-based
   *   command.
   * @param {Command} command - The Commander command to append options
   *   onto.
   * @returns {Command}
   */
  appendPkiCommandOptions: function (command) {
    command.option('--opensslbin <file>',
      'Location of the OpenSSL executable that the command uses. If not ' +
      'specified, the command attempts to find an OpenSSL executable in ' +
      'the current environment path.')
    command.option('-s, --san [value]',
      'add Subject Alternative Name(s) to the CSR', sanOption, [])
    command.option('-P, --passphrase [pass]',
      'Password for the private key. If specified with no value, prompts ' +
      'for the value.')
    Object.keys(pki.SUBJECT_ATTRIBUTES).forEach(function (key) {
      const attributeInfo = pki.SUBJECT_ATTRIBUTES[key]
      const optionName = fieldAsOption(key)
      const optionValue = attributeInfo.optionValue || optionName.toLowerCase()
      command.option('--' + fieldAsOption(key) + ' <' + optionValue + '>',
        attributeInfo.description)
    })
    return command
  },
  /**
   * Process the private key passphrase from the supplied Commander-based
   * command.
   * @param {Command} command - Commander-based command which contains options
   *   to use in generating the CSR and private key.
   * @param {(String|Boolean)} [command.passphrase] - If `true`, prompt from
   *   the command line for the private key passphrase to use and store the
   *   entered value back to the `command.passphrase` property.
   * @param {Function} [responseCallback] - Function to invoke with the result
   *   from private key passphrase processing. The first parameter in the
   *   callback is an `Error` instance if the attempt to obtain the passphrase
   *   fails.
   */
  processPrivateKeyPassphrase: function (command, responseCallback) {
    if (command.passphrase === true) {
      cliUtil.getValueFromPrompt('private key passphrase', true,
        function (error, passphrase) {
          if (error) {
            provisionUtil.invokeCallback(error, responseCallback,
              command.verbosity)
          } else {
            command.passphrase = passphrase
            provisionUtil.invokeCallback(null, responseCallback)
          }
        }
      )
    } else {
      provisionUtil.invokeCallback(null, responseCallback)
    }
  }
}
