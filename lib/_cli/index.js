/**
 * @module Cli
 * @private
 */

'use strict'

var cliUtil = require('./cli-util')

var SUBCOMMANDS = ['generate-csr', 'provision-config', 'update-config']

/**
 * Adds command-line options for each of the available subcommands onto the
 * supplied Commander-based program.
 * @param {Program} program - Commander program onto which to add the options
 *   for this subcommand.
 * @param {Function} [doneCallback] - Callback to invoke once the subcommand is
 *   complete. If an error occurs, the first parameter supplied to the
 *   `doneCallback` is an `Error` instance containing failure details.
 * @private
 */
module.exports = function (program, doneCallback) {
  SUBCOMMANDS.forEach(function (subcommandName) {
    // Create the subcommand
    var subcommandInfo = require('./cli-' + subcommandName)(program)

    var subcommand = subcommandInfo[0]
    var subcommandAction = subcommandInfo[1]

    // Add `verbosity` and `doneCallback` properties to the `command` object
    // before the subcommand's action callback receives it
    subcommand.action(function () {
      if (arguments.length) {
        var cmd = arguments[arguments.length - 1]
        cmd.doneCallback = doneCallback
        cmd.verbosity = cliUtil.getProgramVerbosity(program)
      }
      // Invoke the subcommand action
      subcommandAction.apply(null, arguments)
    })
  })
}
