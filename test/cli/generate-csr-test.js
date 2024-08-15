'use strict'
/* eslint no-unused-expressions: "off" */ // for chai expect assertions

const childProcess = require('child_process')
const expect = require('chai').expect
const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf')
const sinon = require('sinon')
const tmp = require('tmp')
const DxlError = require('../..').DxlError
const cliHelpers = require('./cli-test-helpers')
const pkiHelpers = require('../pki-test-helpers')

describe('generatecsr CLI command @cli', function () {
  let tmpDirSync
  let tmpDir

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
    const command = cliHelpers.cliCommand(
      function (error) {
        expect(error).to.be.null
        const csrFileName = path.join(tmpDir, 'client.csr')
        expect(fs.existsSync(csrFileName)).to.be.true
        try {
          expect(pkiHelpers.getCsrSubject(csrFileName)).to.equal('/CN=client1')
        } catch (e) {
          expect(pkiHelpers.getCsrSubject(csrFileName)).to.equal('CN = client1')
        }
        const privateKeyFileName = path.join(tmpDir, 'client.key')
        pkiHelpers.validateRsaPrivateKey(privateKeyFileName)
        done()
      }
    )
    command.parse(cliArgs(['client1']))
  })

  it('should name csr and private key files with a specified file prefix',
    function (done) {
      const command = cliHelpers.cliCommand(
        function (error) {
          expect(error).to.be.null
          const csrFileName = path.join(tmpDir, 'client3.csr')
          expect(fs.existsSync(csrFileName)).to.be.true
          try {
            expect(pkiHelpers.getCsrSubject(csrFileName)).to.equal('/CN=client2')
          } catch (e) {
            expect(pkiHelpers.getCsrSubject(csrFileName)).to.equal('CN = client2')
          }
          const privateKeyFileName = path.join(tmpDir, 'client3.key')
          pkiHelpers.validateRsaPrivateKey(privateKeyFileName)
          done()
        }
      )
      command.parse(cliArgs(['client2', '-f', 'client3']))
    }
  )

  it('should generate a csr subject with specified DN attributes',
    function (done) {
      const command = cliHelpers.cliCommand(
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
      const command = cliHelpers.cliCommand(
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
      const passphrase = 'itsasecret'
      const command = cliHelpers.cliCommand(
        function (error) {
          expect(error).to.be.null
          const privateKeyFileName = path.join(tmpDir, 'client.key')
          const stderrStub = sinon.stub(console, 'error')
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
    const passphrase = 'supersecret'
    const stdinStub = new cliHelpers.StdinStub(['', passphrase + 'nomatch1',
      passphrase + 'nomatch2', passphrase, passphrase])
    const stdoutStub = new cliHelpers.StdoutStub()

    const command = cliHelpers.cliCommand(
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
        const privateKeyFileName = path.join(tmpDir, 'client.key')
        const stderrStub = sinon.stub(console, 'error')
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
      const dummySslBinPath = path.join(tmpDir, 'openssl.exe')
      const csrFileName = path.join(tmpDir, 'client.csr')
      const privateKeyFileName = path.join(tmpDir, 'client.key')
      const expectedText = 'Written by custom openssl'
      sinon.stub(fs, 'existsSync').withArgs(dummySslBinPath).returns(true)
      sinon.stub(childProcess, 'spawnSync').callsFake(
        function () {
          fs.writeFileSync(csrFileName, expectedText)
          fs.writeFileSync(privateKeyFileName, expectedText)
          return { status: 0 }
        })
      const command = cliHelpers.cliCommand(
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
      const invalidOpensslBin = path.join(tmpDir, 'does-not-exist.exe')
      const command = cliHelpers.cliCommand(
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
