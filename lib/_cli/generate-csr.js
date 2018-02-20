'use strict'

var pki = require('./pki')
var cliUtil = require('./cli-util')

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
