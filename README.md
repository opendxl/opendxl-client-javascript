# OpenDXL JavaScript Client
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## Overview

The OpenDXL JavaScript Client enables the development of applications that
connect to the
[McAfee Data Exchange Layer](http://www.mcafee.com/us/solutions/data-exchange-layer.aspx)
messaging fabric for the purposes of sending/receiving events and
invoking/providing services.

## Documentation

See the
[Python Client SDK Wiki](https://github.com/opendxl/opendxl-client-python/wiki/Data-Exchange-Layer-%28DXL%29-Overview)
for an overview of the Data Exchange Layer (DXL).

See the
[JavaScript Client SDK Documentation](https://opendxl.github.io/opendxl-client-javascript)
for API documentation.

## Prerequisites

* DXL brokers (3.0.1 or later) deployed with an ePO managed environment or an
  [OpenDXL broker](https://github.com/opendxl/opendxl-broker).

* Node.js 4.0 or higher installed.

  >  **Note:** With versions of Node.js older than 4.8.1, you may encounter an
  > error with the following text when your client attempts to connect to the
  > broker:

  > ``Error: unable to get issuer certificate``.

  > No workaround for this issue on the older Node.js versions is known at this time.

## Installation

To install the JavaScript client via [npm](https://www.npmjs.com/), run:

```sh
npm install @opendxl/dxl-client --save
```

To install the JavaScript client along with some examples:

* Download the
  [Latest Release](https://github.com/opendxl/opendxl-client-javascript/releases/latest).
* Extract the release .zip file.

## Provisioning

In order for a client to connect to the DXL fabric, it must be provisioned.

A provisioned client includes certificate information required to establish an
authenticated connection to the fabric as well as information regarding the
brokers to connect to.

For more information on provisioning, see the
[Python SDK documentation](https://opendxl.github.io/opendxl-client-python/pydoc/provisioningoverview.html).

  > **Note:** The JavaScript client does not yet have support for
  > provisioning via the Command Line Interface (CLI) like the
  > [Python client](https://opendxl.github.io/opendxl-client-python/pydoc/basiccliprovisioning.html#basiccliprovisioning)
  > does.

## Examples

For information on the available client examples, see the ``Tutorials`` section
in the
[JavaScript Client SDK Documentation](https://opendxl.github.io/opendxl-client-javascript).

## Bugs and Feedback

For bugs, questions and discussions please use the
[Github Issues](https://github.com/opendxl/opendxl-client-javascript/issues).

## LICENSE

Copyright 2017 McAfee, Inc.

Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.
