'use strict'

var subcommands = ['generate-csr', 'provision-config', 'update-config']

module.exports = function (program) {
  subcommands.forEach(function (subcommand) {
    require('./' + subcommand)(program)
  })
}
