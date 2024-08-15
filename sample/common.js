'use strict'

const fs = require('fs')
const path = require('path')

// Base name of the DXL configuration file used by the SDK samples in
// establishing a client connection
const CONFIG_FILE_NAME = 'dxlclient.config'

// Value in the 'name' field in the SDK package's 'package.json' file
const SDK_PACKAGE_NAME = '@opendxl/dxl-client'

module.exports = {
  /**
   * Location of the DXL configuration file used by the SDK samples in
   * establishing a client connection.
   */
  CONFIG_FILE: path.join(__dirname, CONFIG_FILE_NAME),
  /**
   * Load a module, adjusting for an alternate location when running from an
   * SDK sample.
   *
   * This function adjusts for differences in the module path when
   * running a sample from a repository source checkout vs. an installed
   * release package and for flat (NPM version 2) vs. nested (NPM version 3
   * and later) dependency installation.
   *
   * This function should only be needed for running the SDK samples. For
   * code which references the SDK module as a dependency via an NPM
   * `package.json` file, the built-in `require` can be used directly
   * rather than this wrapper function.
   *
   * @param {String} module - Name of the module to load
   * @returns The result from the underlying call to the built-in `require`
   *   function.
   */
  require: function (module) {
    if (module === SDK_PACKAGE_NAME) {
      const packageFile = path.join(__dirname, '..', 'package.json')
      if (fs.existsSync(packageFile)) {
        const packageInfo = JSON.parse(fs.readFileSync(packageFile))
        if (packageInfo.name === SDK_PACKAGE_NAME) {
          // Use local library sources if the example is being run from source.
          module = '..'
        }
      }
    } else if (fs.existsSync(path.join(__dirname, '..',
      'node_modules', SDK_PACKAGE_NAME, 'node_modules', module))) {
      // Prior to NPM version 3, an 'npm install' would nest a package's
      // dependencies under a 'node_modules' subdirectory. Adjust the module
      // name to reflect the nested location if found there.
      module = '../node_modules/' + SDK_PACKAGE_NAME + '/node_modules/' + module
    }
    return require(module)
  }
}
