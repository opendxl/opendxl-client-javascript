/**
 * @module CliTestHelpers
 * @private
 */

'use strict'

const program = require('commander')
const inherits = require('inherits')
const stream = require('stream')
const cli = require('../../lib/_cli')

const CLI_OUTPUT_VERBOSITY = 0

/**
 * @classdesc Readable stream which replaces process.stdin with itself. Each
 * time a read() call is made to the stream, the next unconsumed chunk from the
 * chunks parameter is provided to the consumer, with a trailing newline
 * character. When restore() is called on this stub, the original stdin stream
 * is restored to process.stdin.
 * @param {String|Array<String>} chunks - One or more chunks to provide to
 *   stream readers.
 * @constructor
 */
function StdinStub (chunks) {
  this._originalStdin = process.stdin
  this.chunks = (typeof chunks === 'string') ? [chunks] : chunks
  this.chunkPosition = 0
  stream.Readable.call(this)
  Object.defineProperty(process, 'stdin', {
    value: this,
    configurable: true,
    writable: false
  })
}

inherits(StdinStub, stream.Readable)

StdinStub.prototype._read = function () {
  if (this.chunkPosition < this.chunks.length) {
    this.push(this.chunks[this.chunkPosition] + '\n')
    this.chunkPosition++
  } else {
    this.push(null)
  }
}

StdinStub.prototype.restore = function () {
  if (process.stdin === this) {
    Object.defineProperty(process, 'stdin', {
      value: this._originalStdin,
      configurable: true,
      writable: false
    })
  }
}

/**
 * @classdesc Writeable stream which replaces process.stdout with itself. Each
 * chunk of data written to the stream is appended onto the data property
 * without being echoed back to the actual stdout for the process. When
 * restore() is called on this stub, the original stdout stream is restored to
 * process.stdout.
 * @constructor
 */
function StdoutStub () {
  this._originalStdout = process.stdout
  this.data = ''
  stream.Writable.call(this)
  Object.defineProperty(process, 'stdout', {
    value: this,
    configurable: true,
    writable: false
  })
}

inherits(StdoutStub, stream.Writable)

StdoutStub.prototype._write = function (chunk, encoding, callback) {
  this.data += chunk.toString()
  if (callback) {
    callback()
  }
}

StdoutStub.prototype._writev = function (chunks, callback) {
  chunks.forEach(function (chunk) {
    this.data += chunk.toString()
  })
  if (callback) {
    callback()
  }
}

StdoutStub.prototype._final = function (callback) {
  if (callback) {
    callback()
  }
}

StdoutStub.prototype.restore = function () {
  if (process.stdout === this) {
    Object.defineProperty(process, 'stdout', {
      value: this._originalStdout,
      configurable: true,
      writable: false
    })
  }
}

module.exports = {
  /**
   * Constructs a Commander command object with subcommands registered.
   * @returns {Command}
   */
  cliCommand: function (doneCallback) {
    const command = new program.Command()
    command.verbose = CLI_OUTPUT_VERBOSITY
    if (!CLI_OUTPUT_VERBOSITY) {
      command.quiet = true
    }
    cli(command, doneCallback)
    return command
  },
  StdinStub,
  StdoutStub
}
