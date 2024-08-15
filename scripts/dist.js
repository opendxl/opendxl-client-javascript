#!/usr/bin/env node

'use strict'

const fs = require('fs')
const path = require('path')
const archiver = require('archiver')

const VERSION = process.env.npm_package_version
const PACKAGE_NAME = process.env.npm_package_name
if (!VERSION || !PACKAGE_NAME) {
  console.error('Unable to determine package version or name. Try running ' +
    "this script via 'npm run " + path.basename(__filename, '.js') + "'.")
  process.exit(1)
}

const TARBALL_NAME = PACKAGE_NAME.replace(/^@/, '').replace('/', '-') +
  '-' + VERSION + '.tgz'
const RELEASE_ZIP_NAME = 'dxlclient-javascript-sdk-' + VERSION
const RELEASE_ZIP = RELEASE_ZIP_NAME + '.zip'

const DOC_SOURCE_DIR = path.join('out', 'jsdoc')
const DOC_TARGET_DIR = path.join(RELEASE_ZIP_NAME, 'doc')
const SAMPLE_DIR = 'sample'

const output = fs.createWriteStream(RELEASE_ZIP)
const archive = archiver('zip')

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
  const sourcePath = path.join(SAMPLE_DIR, sampleFile)
  if (fs.statSync(sourcePath).isDirectory()) {
    archive.directory(sourcePath, path.join(RELEASE_ZIP_NAME, sourcePath))
  } else if (sampleFile.match(/\.js$/)) {
    archive.file(sourcePath, { name: path.join(RELEASE_ZIP_NAME, sourcePath) })
  } else {
    const templateFile = sampleFile.match(/^(.*)\.template$/)
    if (templateFile) {
      archive.file(sourcePath,
        { name: path.join(RELEASE_ZIP_NAME, SAMPLE_DIR, templateFile[1]) })
    }
  }
})

archive.directory(DOC_SOURCE_DIR, DOC_TARGET_DIR)
archive.file(path.join('doc', 'README.html'),
  { name: path.join(RELEASE_ZIP_NAME, 'README.html') })
archive.file(TARBALL_NAME, {
  name: path.join(RELEASE_ZIP_NAME, 'lib',
    TARBALL_NAME)
})
archive.finalize()
