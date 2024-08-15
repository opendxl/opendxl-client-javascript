#!/usr/bin/env node

'use strict'

const program = require('commander')
const cli = require('../lib/_cli')
const cliUtil = require('../lib/_cli/cli-util')
const provisionUtil = require('../lib/_provisioning/provision-util')

function processError (error) {
  if (error) {
    const verbosity = cliUtil.getProgramVerbosity(program)
    if (verbosity) {
      provisionUtil.logError(error, { verbosity })
    }
    process.exit(1)
  }
}

program
  .option('-q, --quiet',
    'show only errors (no info/debug/messages) while a command is running')
  .option('-v, --verbose', 'Verbose mode. Additional v characters increase ' +
    'verbosity level, e.g., -vv, -vvv.',
  function (_, total) { return total + 1 }, 1)

cli(program, processError)
program.parse(process.argv)
