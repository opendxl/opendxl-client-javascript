#!/usr/bin/env node

'use strict'

var fs = require('fs')
var path = require('path')

var DOC_SOURCE_DIR = path.join('out', 'jsdoc')
var INSTALL_TUTORIAL_HTML = path.join(DOC_SOURCE_DIR,
  'tutorial-installation.html')
var VERSION = process.env.npm_package_version
if (!VERSION) {
  console.error('Unable to determine package version. Try running this ' +
    "script via 'npm run " + path.basename(__filename, '.js') + "'.")
  process.exit(1)
}
var RELEASE_ZIP_NAME = 'dxlclient-javascript-sdk-' + VERSION

var installHtmlText = fs.readFileSync(INSTALL_TUTORIAL_HTML, 'utf-8')
fs.writeFileSync(INSTALL_TUTORIAL_HTML,
  installHtmlText.replace(/{@releasezipname}/g, RELEASE_ZIP_NAME))
