/**
 * @module CliUpdateConfig
 * @private
 */

'use strict'

const cliUtil = require('./cli-util')
const provisionUtil = require('../_provisioning/provision-util')
const updateConfig = require('../_provisioning/update-config')

/**
 * Action function invoked for the updateconfig subcommand.
 * @param {String} configDir - Directory in which to store the private key
 *   and CSR file.
 * @param {String} hostname - Name of the management service host.
 * @param {Command} command - The Commander command to append options onto.
 */
function cliUpdateConfig (configDir, hostname, command) {
  cliUtil.fillEmptyServerCredentialsFromPrompt(command,
    function (error) {
      if (error) {
        provisionUtil.invokeCallback(error, command.doneCallback,
          command.verbosity)
      } else {
        updateConfig(configDir,
          cliUtil.pullHostInfoFromCommand(hostname, command),
          command)
      }
    }
  )
}

/**
 * Subcommand for updating the DXL client configuration in the dxlclient.config
 * file, specifically the ca bundle and broker configuration. See
 * {@link module:UpdateConfig} for more details on what this subcommand does.
 * @param {Program} program - Commander program onto which to add the options
 *   for this subcommand.
 * @returns {Command} The Commander command which was added to the program
 *   for this subcommand.
 * @private
 */
module.exports = function (program) {
  const command = program
    .command('updateconfig <config_dir> <host_name>')
    .description('update the DXL client configuration')
  return [cliUtil.appendManagementServiceCommandOptions(command),
    cliUpdateConfig]
}
