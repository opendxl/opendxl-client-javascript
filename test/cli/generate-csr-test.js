'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

var childProcess = require('child_process')
var expect = require('chai').expect
var fs = require('fs')
var path = require('path')
var rimraf = require('rimraf')
var sinon = require('sinon')
var tmp = require('tmp')
var DxlError = require('../..').DxlError
var cliHelpers = require('./cli-test-helpers')
var pkiHelpers = require('../pki-test-helpers')

describe('generatecsr CLI command @cli', function () {
  var tmpDirSync
  var tmpDir

  beforeEach(function () {
    tmpDirSync = tmp.dirSync()
    tmpDir = tmpDirSync.name
  })

  afterEach(function () {
    if (fs.existsSync.restore) {
      fs.existsSync.restore()
    }
    if (childProcess.spawnSync.restore) {
      childProcess.spawnSync.restore()
    }
    rimraf.sync(tmpDir)
  })

  function cliArgs (args) {
    return ['node', 'dxlclient', 'generatecsr', tmpDir].concat(args)
  }

  it('should generate a proper csr and private key', function (done) {
    var command = cliHelpers.cliCommand(
      function (error) {
        expect(error).to.be.null
        var csrFileName = path.join(tmpDir, 'client.csr')
        expect(fs.existsSync(csrFileName)).to.be.true
        try {
          expect(pkiHelpers.getCsrSubject(csrFileName)).to.equal('/CN=client1')
        } catch (e) {
          expect(pkiHelpers.getCsrSubject(csrFileName)).to.equal('CN = client1')
        }
        var privateKeyFileName = path.join(tmpDir, 'client.key')
        pkiHelpers.validateRsaPrivateKey(privateKeyFileName)
        done()
      }
    )
    command.parse(cliArgs(['client1']))
  })

  it('should name csr and private key files with a specified file prefix',
    function (done) {
      var command = cliHelpers.cliCommand(
        function (error) {
          expect(error).to.be.null
          var csrFileName = path.join(tmpDir, 'client3.csr')
          expect(fs.existsSync(csrFileName)).to.be.true
          try {
            expect(pkiHelpers.getCsrSubject(csrFileName)).to.equal('/CN=client2')
          } catch (e) {
            expect(pkiHelpers.getCsrSubject(csrFileName)).to.equal('CN = client2')
          }
          var privateKeyFileName = path.join(tmpDir, 'client3.key')
          pkiHelpers.validateRsaPrivateKey(privateKeyFileName)
          done()
        }
      )
      command.parse(cliArgs(['client2', '-f', 'client3']))
    }
  )

  it('should generate a csr subject with specified DN attributes',
    function (done) {
      var command = cliHelpers.cliCommand(
        function (error) {
          expect(error).to.be.null
          // format is different based on openssl version
          try {
            expect(pkiHelpers.getCsrSubject(path.join(tmpDir, 'client.csr'))).to
              .equal('/CN=client/C=US/ST=OR/L=Hillsboro/O=McAfee' +
                '/OU=DXL Team/emailAddress=jane.doe@mcafee.com')
          } catch (e) {
            expect(pkiHelpers.getCsrSubject(path.join(tmpDir, 'client.csr'))).to
              .equal('CN = client, C = US, ST = OR, L = Hillsboro, O = McAfee, ' +
                'OU = DXL Team, emailAddress = jane.doe@mcafee.com')
          }
          done()
        }
      )
      command.parse(cliArgs(['client', '--country', 'US',
        '--state-or-province', 'OR', '--locality', 'Hillsboro',
        '--organization', 'McAfee', '--organizational-unit', 'DXL Team',
        '--email-address', 'jane.doe@mcafee.com'
      ]))
    }
  )

  it('should generate a csr with specified subject alternative names',
    function (done) {
      var command = cliHelpers.cliCommand(
        function (error) {
          expect(error).to.be.null
          expect(pkiHelpers.getSubjectAlternativeNames(path.join(tmpDir,
            'client.csr'))).to.eql(['DNS:host1.com', 'DNS:host2.com'])
          done()
        }
      )
      command.parse(cliArgs(['client', '-s', 'host1.com', '-s', 'host2.com']))
    }
  )

  it('should encrypt a private key with a specified passphrase',
    function (done) {
      var passphrase = 'itsasecret'
      var command = cliHelpers.cliCommand(
        function (error) {
          expect(error).to.be.null
          var privateKeyFileName = path.join(tmpDir, 'client.key')
          var stderrStub = sinon.stub(console, 'error')
          // Validate that supplying no decryption password throws an error
          expect(pkiHelpers.validateRsaPrivateKey.bind(null, privateKeyFileName))
            .to.throw(DxlError)
          // Validate that supplying the wrong decryption password throws an error
          expect(pkiHelpers.validateRsaPrivateKey.bind(null, privateKeyFileName,
            'mybadpass')).to.throw(DxlError)
          stderrStub.restore()
          // Validate that supplying the right password is successful
          pkiHelpers.validateRsaPrivateKey(privateKeyFileName, passphrase)
          done()
        }
      )
      command.parse(cliArgs(['client', '-P', passphrase]))
    }
  )

  it('should prompt for passphrase option with no value', function (done) {
    var passphrase = 'supersecret'
    var stdinStub = new cliHelpers.StdinStub(['', passphrase + 'nomatch1',
      passphrase + 'nomatch2', passphrase, passphrase])
    var stdoutStub = new cliHelpers.StdoutStub()

    var command = cliHelpers.cliCommand(
      function (error) {
        stdinStub.restore()
        stdoutStub.restore()
        expect(error).to.be.null
        expect(stdoutStub.data).to.equal('Enter private key passphrase: ' +
          'Value cannot be empty. Try again.\n' +
          'Enter private key passphrase: ' +
          'Confirm private key passphrase: ' +
          'Values for private key passphrase do not match. Try again.\n' +
          'Enter private key passphrase: ' +
          'Confirm private key passphrase: ')
        var privateKeyFileName = path.join(tmpDir, 'client.key')
        var stderrStub = sinon.stub(console, 'error')
        // Validate that supplying no decryption password throws an error
        expect(pkiHelpers.validateRsaPrivateKey.bind(
          null, privateKeyFileName)).to.throw(DxlError)
        stderrStub.restore()
        // Validate that supplying the right password is successful
        pkiHelpers.validateRsaPrivateKey(privateKeyFileName, passphrase)
        done()
      }
    )
    command.parse(cliArgs(['client', '-P']))
  })

  it('should use an explicit path to the openssl command when specified',
    function (done) {
      var dummySslBinPath = path.join(tmpDir, 'openssl.exe')
      var csrFileName = path.join(tmpDir, 'client.csr')
      var privateKeyFileName = path.join(tmpDir, 'client.key')
      var expectedText = 'Written by custom openssl'
      sinon.stub(fs, 'existsSync').withArgs(dummySslBinPath).returns(true)
      sinon.stub(childProcess, 'spawnSync').callsFake(
        function () {
          fs.writeFileSync(csrFileName, expectedText)
          fs.writeFileSync(privateKeyFileName, expectedText)
          return {status: 0}
        })
      var command = cliHelpers.cliCommand(
        function (error) {
          expect(error).to.be.null
          fs.existsSync.restore()
          expect(fs.existsSync(csrFileName)).to.be.true
          expect(fs.readFileSync(csrFileName, 'utf-8')).to.equal(expectedText)
          expect(fs.existsSync(privateKeyFileName)).to.be.true
          expect(fs.readFileSync(privateKeyFileName, 'utf-8')).to.equal(
            expectedText)
          done()
        }
      )
      command.parse(cliArgs(['client', '--opensslbin', dummySslBinPath]))
    }
  )

  it('should deliver an error for a non-existent openssl command',
    function (done) {
      var invalidOpensslBin = path.join(tmpDir, 'does-not-exist.exe')
      var command = cliHelpers.cliCommand(
        function (error) {
          expect(error).to.be.an.instanceof(DxlError)
          expect(error.message).to.equal(
            'Unable to find openssl at: ' + invalidOpensslBin)
          done()
        }
      )
      command.parse(cliArgs(['client', '--opensslbin', invalidOpensslBin]))
    }
  )
})
