'use strict'

var pki = require('./pki')
var cliUtil = require('./cli-util')

function generateCsr (configDir, commonName, command, verbosity) {
  pki.generatePrivateKeyAndCsr(configDir, commonName, command, verbosity)
}

module.exports = function (program) {
  var command = program.command('generatecsr <config_dir> <common_name>')
  command
    .description('generate CSR and private key')
    .option('-f, --file-prefix <prefix>',
      'file prefix to use for CSR and key files', 'client')
    .action(cliUtil.addProgramArgsToAction(program, generateCsr))
  pki.appendPkiCommandOptions(command)
}
