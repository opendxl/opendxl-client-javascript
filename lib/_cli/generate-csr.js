'use strict'

var pki = require('./pki')
var cliUtil = require('./cli-util')

function generateCsr (configDir, commonName, command, verbosity) {
  pki.generatePrivateKeyAndCsr(configDir, commonName, command, verbosity)
}

module.exports = function (program) {
  program
    .command('generatecsr <CONFIG_DIR> <COMMON_NAME>')
    .description('generate CSR and private key')
    .option('-f, --file-prefix <prefix>',
      'file prefix to use for CSR and key files', 'client')
    .option('--opensslbin <file>',
      'Location of the OpenSSL executable that the command uses. If not ' +
      'specified, the command attempts to find an OpenSSL executable in the ' +
      'current environment path.'
    )
    .action(cliUtil.addProgramArgsToAction(program, generateCsr))
}
