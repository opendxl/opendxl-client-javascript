/**
 * @module CliGenerateCsr
 * @private
 */

'use strict'

const pki = require('../_provisioning/pki')
const cliPki = require('./cli-pki')
const provisionUtil = require('../_provisioning/provision-util')

/**
 * Action function invoked for the generatecsr subcommand.
 * @param {String} configDir - Directory in which to store the private key
 *   and CSR file.
 * @param {String} commonOrCsrFileName - A string representing either
 *   a common name (CN) to add into the generated file or the path to the
 *   location of an existing CSR file. The parameter is interpreted as a path
 *   to an existing CSR file if a property named certRequestFile exists on the
 *   command object and has a truthy value. If the parameter represents a path
 *   to an existing CSR file, this function does not generate a new CSR file.
 * @param {Command} command - The Commander command to append options onto.
 */
function cliGenerateCsr (configDir, commonOrCsrFileName, command) {
  cliPki.processPrivateKeyPassphrase(command,
    function (error) {
      if (error) {
        provisionUtil.invokeCallback(error, command.doneCallback,
          command.verbosity)
      } else {
        pki.generatePrivateKeyAndCsr(configDir, commonOrCsrFileName, command)
      }
    }
  )
}

/**
 * Subcommand for generating a certificate signing request and private key,
 * storing each to a file.
 * @param {Program} program - Commander program onto which to add the
 *   options for this subcommand.
 * @returns {Command} The Commander command which was added to the program
 *   for this subcommand.
 * @private
 */
module.exports = function (program) {
  const command = program.command('generatecsr <config_dir> <common_name>')
  command
    .description('generate CSR and private key')
    .option('-f, --file-prefix <prefix>',
      'file prefix to use for CSR and key files', 'client')
  return [cliPki.appendPkiCommandOptions(command), cliGenerateCsr]
}
