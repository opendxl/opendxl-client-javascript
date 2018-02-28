#!/usr/bin/env node

'use strict'

var fs = require('fs')
var path = require('path')

var VERSION = process.env.npm_package_version
var PACKAGE_NAME = process.env.npm_package_name
if (!VERSION || !PACKAGE_NAME) {
  console.error('Unable to determine package version or name. Try running ' +
    "this script via 'npm run " + path.basename(__filename, '.js') + "'.")
  process.exit(1)
}

var TARBALL_NAME = PACKAGE_NAME.replace(/^@/, '').replace('/', '-') +
  '-' + VERSION + '.tgz'
var RELEASE_ZIP_NAME = 'dxlclient-javascript-sdk-' + VERSION

var DOC_SOURCE_DIR = path.join('out', 'jsdoc')
var INSTALL_TUTORIAL_HTML = path.join(DOC_SOURCE_DIR,
  'tutorial-installation.html')

var installHtmlText = fs.readFileSync(INSTALL_TUTORIAL_HTML, 'utf-8')
installHtmlText = installHtmlText.replace(/{@releasezipname}/g,
  RELEASE_ZIP_NAME)
installHtmlText = installHtmlText.replace(/{@releasetarballname}/g,
  TARBALL_NAME)
fs.writeFileSync(INSTALL_TUTORIAL_HTML, installHtmlText)
