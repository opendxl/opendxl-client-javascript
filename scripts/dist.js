#!/usr/bin/env node

'use strict'

var fs = require('fs')
var path = require('path')
var archiver = require('archiver')

var VERSION = process.env.npm_package_version
var PACKAGE_NAME = process.env.npm_package_name
if (!VERSION || !PACKAGE_NAME) {
  console.error('Unable to determine package version or name. Try running ' +
    "this script via 'npm run dist'.")
  process.exit(1)
}

var TARBALL_NAME = PACKAGE_NAME.replace(/^@/, '').replace('/', '-') +
  '-' + VERSION + '.tgz'
var RELEASE_ZIP = 'dxlclient-javascript-sdk-' + VERSION + '.zip'

var DOC_SOURCE_DIR = 'out/jsdoc'
var DOC_TARGET_DIR = 'doc'
var SAMPLE_DIR = 'sample'

var output = fs.createWriteStream(RELEASE_ZIP)
var archive = archiver('zip')

output.on('close', function () {
  console.log('Wrote ' + RELEASE_ZIP)
})

archive.on('warning', function (err) {
  throw err
})

archive.on('error', function (err) {
  throw err
})

archive.pipe(output)

fs.readdirSync(SAMPLE_DIR).forEach(function (sampleFile) {
  var sourcePath = path.join(SAMPLE_DIR, sampleFile)
  if (fs.statSync(sourcePath).isDirectory()) {
    archive.directory(sourcePath, sourcePath)
  } else if (sampleFile.match(/\.js$/)) {
    archive.file(sourcePath, {name: sourcePath})
  } else {
    var templateFile = sampleFile.match(/^(.*)\.template$/)
    if (templateFile) {
      archive.file(sourcePath, {name: path.join(SAMPLE_DIR, templateFile[1])})
    }
  }
})

archive.directory(DOC_SOURCE_DIR, DOC_TARGET_DIR)
archive.file('doc/README.html', {name: 'README.html'})
archive.file(TARBALL_NAME, {name: 'lib/' + TARBALL_NAME})
archive.finalize()
