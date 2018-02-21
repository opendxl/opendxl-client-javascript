'use strict'

var pki = require('./pki')
var cliUtil = require('./cli-util')

/**
 * Subcommand for generating a certificate signing request and private key,
 * storing each to a file.
 * @param {Program} program - Commander program onto which to add the options
 *   for this subcommand.
 * @private
 */
module.exports = function (program) {
  var command = program.command('generatecsr <config_dir> <common_name>')
  command
    .description('generate CSR and private key')
    .option('-f, --file-prefix <prefix>',
      'file prefix to use for CSR and key files', 'client')
    .action(function (configDir, commonOrCsrFileName, command) {
      pki.generatePrivateKeyAndCsr(configDir, commonOrCsrFileName, command,
        cliUtil.getProgramVerbosity(program), program.doneCallback)
    })
  pki.appendPkiCommandOptions(command)
}
