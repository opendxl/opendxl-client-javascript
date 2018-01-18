# OpenDXL JavaScript Client
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Overview

The OpenDXL JavaScript Client enables the development of applications that
connect to the
[McAfee Data Exchange Layer](http://www.mcafee.com/us/solutions/data-exchange-layer.aspx)
messaging fabric for the purposes of sending/receiving events and
invoking/providing services.

## Documentation

See the [Wiki](https://github.com/opendxl/opendxl-client-javascript/wiki)
for an overview of the Data Exchange Layer (DXL), the OpenDXL JavaScript client,
and examples.

See the
[JavaScript Client SDK Documentation](https://opendxl.github.io/opendxl-client-javascript)
for API documentation.

## Differences from the OpenDXL Python Client

The OpenDXL JavaScript Client does not have complete feature parity with the
[OpenDXL Python Client](https://github.com/opendxl/opendxl-client-python). The
following functionality is currently missing from the JavaScript client:

* Synchronous client APIs &mdash; including
  [sync_request](https://opendxl.github.io/opendxl-client-python/pydoc/dxlclient.client.html#dxlclient.client.DxlClient.sync_request)
  and
  [register_service_sync](https://opendxl.github.io/opendxl-client-python/pydoc/dxlclient.client.html#dxlclient.client.DxlClient.register_service_sync)
  &mdash; are not available in the JavaScript client. Unlike with the Python
  client, communication with the broker for JavaScript client methods like
  [connect](https://opendxl.github.io/opendxl-client-javascript/Client.html#connect)
  and
  [subscribe](https://opendxl.github.io/opendxl-client-javascript/Client.html#subscribe)
  is all done asynchronously as well. Due to the asynchronous nature of
  JavaScript and a lack of underlying support for synchronous MQTT operations in
  the [MQTT.js](https://github.com/mqttjs/MQTT.js) library that the OpenDXL
  JavaScript client depends upon, it is unlikely that synchronous forms of these
  APIs will ever be added to the JavaScript client.
* Unlike the Python client, the JavaScript client does not provide a method to
  configure a separate thread pool for handling incoming messages in parallel
  &mdash; including the [incoming_message_thread_pool_size](https://opendxl.github.io/opendxl-client-python/pydoc/dxlclient.client_config.html#dxlclient.client_config.DxlClientConfig.incoming_message_thread_pool_size)
  setting. Message callbacks received by the JavaScript client are processed
  one at a time via the [event loop](https://developer.mozilla.org/en-US/docs/Web/JavaScript/EventLoop). 
* Client provisioning via a Node.js-based command line interface. Note that the
  JavaScript client can, however, make use of a configuration provisioned with
  the [OpenDXL Python CLI](https://opendxl.github.io/opendxl-client-python/pydoc/basiccliprovisioning.html).
* The Python client randomizes the delay between client reconnect attempts.  The
  JavaScript client currently uses a fixed [reconnect_delay](https://opendxl.github.io/opendxl-client-javascript/Config.html)
  for reconnect attempts.
* Unlike the Python client, the JavaScript client does not currently provide a
  way to configure the maximum number of
  [connect_retries](https://opendxl.github.io/opendxl-client-python/pydoc/dxlclient.client_config.html#dxlclient.client_config.DxlClientConfig.connect_retries)
  for a client connection. The JavaScript client will indefinitely retry
  failed connection attempts until a call to either
  [disconnect](https://opendxl.github.io/opendxl-client-javascript/Client.html#disconnect)
  or
  [destroy](https://opendxl.github.io/opendxl-client-javascript/Client.html#destroy)
  is made.
* The JavaScript client only sparingly logs messages &mdash; for successful
  and failed connections &mdash; and only to the [console log](https://developer.mozilla.org/en-US/docs/Web/API/Console/log).
  Support for more complete logging, log levels, and pluggable use of logging
  frameworks will be considered for a future release.

## Prerequisites

* DXL brokers (3.0.1 or later) deployed with an ePO managed environment or an
  [OpenDXL broker](https://github.com/opendxl/opendxl-broker).

* Node.js 4.0 or higher installed.

  >  **Note:** With versions of Node.js older than 4.8.1, you may encounter an
  > error with the following text when your client attempts to connect to the
  > broker:

  ```sh
  Error: unable to get issuer certificate
  ```

  > No workaround for this issue on the older Node.js versions is known at this time.

* An OpenSSL version used by Node.js that supports TLSv1.2 (Version 1.0.1 or
  greater).

  To check the version of OpenSSL used by Node.js, type the following statement:

  ```sh
  $ node -pe process.versions.openssl
  ```

  The output should appear similar to the following:

  ```sh
  1.0.2n
  ```

  The version must be 1.0.1 or greater. Unfortunately, even the latest versions
  of OSX (Mac) still have version 0.9.8 installed by default. If you wish to use
  the JavaScript SDK with OSX, one possible workaround is to use a third party
  package manager (such as [Homebrew](http://brew.sh/)) to install a compatible
  Node.js and OpenSSL version.

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
