'use strict'

var subcommands = ['generate-csr', 'provision-config', 'update-config']

/**
 * Adds command-line options for each of the available subcommands onto the
 * supplied Commander-based program.
 * @param {Program} program - Commander program onto which to add the options
 *   for this subcommand.
 * @private
 */
module.exports = function (program) {
  subcommands.forEach(function (subcommand) {
    require('./' + subcommand)(program)
  })
}
