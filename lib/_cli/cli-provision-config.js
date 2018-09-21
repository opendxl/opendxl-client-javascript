/**
 * @module CliProvisionConfig
 * @private
 */

'use strict'

var cliPki = require('./cli-pki')
var cliUtil = require('./cli-util')
var provisionConfig = require('../_provisioning/provision-config')
var provisionUtil = require('../_provisioning/provision-util')

/**
 * Action function invoked for the provisionconfig subcommand.
 * @param {String} configDir - Directory in which to store the private key
 *   and CSR file.
 * @param {String} hostname - Name of the management service host.
 * @param {String} commonOrCsrFileName - A string representing either
 *   a common name (CN) to add into the generated file or the path to the
 *   location of an existing CSR file. The parameter is interpreted as a path
 *   to an existing CSR file if a property named certRequestFile exists on the
 *   command object and has a truthy value. If the parameter represents a path
 *   to an existing CSR file, this function does not generate a new CSR file.
 * @param {Command} command - The Commander command to append options onto.
 */
function cliProvisionConfig (configDir, hostname,
                             commonOrCsrFileName, command) {
  cliUtil.fillEmptyServerCredentialsFromPrompt(command,
    function (error) {
      if (error) {
        provisionUtil.invokeCallback(error, command.doneCallback,
          command.verbosity)
      } else {
        cliPki.processPrivateKeyPassphrase(command,
          function (error) {
            if (error) {
              provisionUtil.invokeCallback(error, command.doneCallback,
                command.verbosity)
            } else {
              provisionConfig(configDir, commonOrCsrFileName,
                cliUtil.pullHostInfoFromCommand(hostname, command),
                command)
            }
          }
        )
      }
    })
}

/**
 * Subcommand for provisioning a DXL client. See {@link module:ProvisionConfig}
 * for more details on what this subcommand does.
 * @param {Command} program - Commander command onto which to add the
 *   options for this subcommand.
 * @returns {Command} The Commander command which was added to the program
 *   for this subcommand.
 * @private
 */
module.exports = function (program) {
  var command = program.command(
    'provisionconfig <config_dir> <host_name> <common_or_csrfile_name>')
    .description('download and provision the DXL client configuration')
    .option('-f, --file-prefix <prefix>',
      'file prefix to use for CSR, key, and cert files', 'client')
  cliUtil.appendManagementServiceCommandOptions(command)
    .option('-r, --cert-request-file',
      'Interpret common_or_csrfile_name as a filename for an existing csr ' +
      'to be signed. If not specified, a new csr is generated.')
  return [cliPki.appendPkiCommandOptions(command), cliProvisionConfig]
}
