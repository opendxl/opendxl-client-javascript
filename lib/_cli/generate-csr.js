'use strict'

var util = require('./util')

function generateCsr (configDir, commonName, command, verbosity) {
  util.generatePrivateKeyAndCsr(configDir, command.filePrefix, commonName,
    verbosity)
}

module.exports = function (program) {
  program
    .command('generatecsr <CONFIG_DIR> <COMMON_NAME>')
    .description('generate CSR and private key')
    .option('-f, --file-prefix <file-prefix>',
      'file prefix to use for CSR and key files', 'client')
    .action(util.addProgramArgsToAction(program, generateCsr))
}
