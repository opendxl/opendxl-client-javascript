#!/usr/bin/env node

'use strict'

var program = require('commander')
var cli = require('../lib/_cli')
var util = require('../lib/_cli/util')

process.on('uncaughtException', function (err) {
  var verbosity = util.getProgramVerbosity(program)
  switch (verbosity) {
    case 0:
      process.exit(1)
    case 1:
      util.logError(err.message)
      process.exit(1)
    default:
      throw err
  }
})

program
  .option('-s, --silent', 'show only errors (no info/debug/messages) while a ' +
    'command is running')
  .option('-v, --verbose', 'Verbose mode. Additional v characters increase ' +
    'verbosity level, e.g., -vv, -vvv.',
    function (_, total) { return total + 1 }, 1)

cli(program)
program.parse(process.argv)