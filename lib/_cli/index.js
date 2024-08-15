/**
 * @module Cli
 * @private
 */

'use strict'

const cliUtil = require('./cli-util')

const SUBCOMMANDS = ['generate-csr', 'provision-config', 'update-config']

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
    const subcommandInfo = require('./cli-' + subcommandName)(program)

    const subcommand = subcommandInfo[0]
    const subcommandAction = subcommandInfo[1]

    // Add `verbosity` and `doneCallback` properties to the `command` object
    // before the subcommand's action callback receives it
    subcommand.action(function () {
      if (arguments.length) {
        const cmd = arguments[arguments.length - 1]
        cmd.doneCallback = doneCallback
        cmd.verbosity = cliUtil.getProgramVerbosity(program)
      }
      // Invoke the subcommand action
      subcommandAction.apply(null, arguments)
    })
  })
}
