#!/usr/bin/env node

'use strict'

var program = require('commander')
var cli = require('../lib/_cli')
var cliUtil = require('../lib/_cli/cli-util')
var provisionUtil = require('../lib/_provisioning/provision-util')

function processError (error) {
  if (error) {
    var verbosity = cliUtil.getProgramVerbosity(program)
    switch (verbosity) {
      case 0:
        process.exit(1) // jshint ignore:line
      case 1:
        provisionUtil.logError(error.message)
        process.exit(1) // jshint ignore:line
      default:
        throw error
    }
  }
}

process.on('uncaughtException', processError)

program
  .option('-q, --quiet',
    'show only errors (no info/debug/messages) while a command is running')
  .option('-v, --verbose', 'Verbose mode. Additional v characters increase ' +
    'verbosity level, e.g., -vv, -vvv.',
    function (_, total) { return total + 1 }, 1)

cli(program, processError)
program.parse(process.argv)
