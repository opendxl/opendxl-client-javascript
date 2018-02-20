'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var expect = require('chai').expect
var fs = require('fs')
var path = require('path')
var rimraf = require('rimraf')
var sinon = require('sinon')
var tmp = require('tmp')
var CliError = require('../../lib/_cli/cli-error')
var cliHelpers = require('./cli-test-helpers')

describe('generatecsr CLI command @cli', function () {
  var command
  var tmpDirSync
  var tmpDir

  beforeEach(function () {
    command = cliHelpers.cliCommand()
    tmpDirSync = tmp.dirSync()
    tmpDir = tmpDirSync.name
  })

  afterEach(function () {
    rimraf.sync(tmpDir)
  })

  function cliArgs (args) {
    return ['node', 'dxlclient', 'generatecsr', tmpDir].concat(args)
  }

  it('should generate a proper csr and private key', function (done) {
    command.doneCallback = function () {
      var csrFileName = path.join(tmpDir, 'client.csr')
      expect(fs.existsSync(csrFileName)).to.be.true
      expect(cliHelpers.getCsrSubject(csrFileName)).to.equal('/CN=client1')
      var privateKeyFileName = path.join(tmpDir, 'client.key')
      cliHelpers.validateRsaPrivateKey(privateKeyFileName)
      done()
    }
    command.parse(cliArgs(['client1']))
  })

  it('should name csr and private key files with a specified file prefix',
    function (done) {
      command.doneCallback = function () {
        var csrFileName = path.join(tmpDir, 'client3.csr')
        expect(fs.existsSync(csrFileName)).to.be.true
        expect(cliHelpers.getCsrSubject(csrFileName)).to.equal('/CN=client2')
        var privateKeyFileName = path.join(tmpDir, 'client3.key')
        cliHelpers.validateRsaPrivateKey(privateKeyFileName)
        done()
      }
      command.parse(cliArgs(['client2', '-f', 'client3']))
    }
  )

  it('should generate a csr subject with specified DN attributes',
    function (done) {
      command.doneCallback = function () {
        expect(cliHelpers.getCsrSubject(path.join(tmpDir, 'client.csr'))).to
          .equal('/CN=client/C=US/ST=OR/L=Hillsboro/O=McAfee' +
            '/OU=DXL Team/emailAddress=jane.doe@mcafee.com')
        done()
      }
      command.parse(cliArgs(['client', '--country', 'US',
        '--state-or-province', 'OR', '--locality', 'Hillsboro',
        '--organization', 'McAfee', '--organizational-unit', 'DXL Team',
        '--email-address', 'jane.doe@mcafee.com'
      ]))
    }
  )

  it('should generate a csr with specified subject alternative names',
    function (done) {
      command.doneCallback = function () {
        expect(cliHelpers.getSubjectAlternativeNames(path.join(tmpDir,
          'client.csr'))).to.eql(['DNS:host1.com', 'DNS:host2.com'])
        done()
      }
      command.parse(cliArgs(['client', '-s', 'host1.com', '-s', 'host2.com']))
    }
  )

  it('should encrypt a private key with a specified passphrase',
    function (done) {
      command.doneCallback = function () {
        var privateKeyFileName = path.join(tmpDir, 'client.key')
        var stderrStub = sinon.stub(console, 'error')
        // Validate that supplying no decryption password throws an error
        expect(cliHelpers.validateRsaPrivateKey.bind(null,
          privateKeyFileName)).to.throw(CliError)
        // Validate that supplying the wrong decryption password throws an error
        expect(cliHelpers.validateRsaPrivateKey.bind(null, privateKeyFileName,
          'mybadpass')).to.throw(CliError)
        stderrStub.restore()
        // Validate that supplying the right password is successful
        cliHelpers.validateRsaPrivateKey.bind(null, privateKeyFileName,
          'itsasecret')
        done()
      }
      command.parse(cliArgs(['client', '-P', 'itsasecret']))
    }
  )
})
