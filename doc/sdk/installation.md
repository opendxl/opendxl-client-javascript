### Prerequisites

To use the OpenDXL JavaScript Client the following prerequisites must be
satisfied:

* DXL brokers (3.0.1 or later) deployed with an ePO managed environment or an
  [OpenDXL broker](https://github.com/opendxl/opendxl-broker).

* Node.js 4.0 or higher installed.

  >  **Note:** With versions of Node.js older than 4.8.1, you may encounter an
  > error with the following text when your client attempts to connect to the
  > broker:

  ```sh
  Error: unable to get issuer certificate
  ```

  > No workaround for this issue on the older Node.js versions is known at this
  > time.

### Installation

Before installing the JavaScript client, change to the directory which you
extracted from the SDK zip file. For example:

```sh
cd {@releasezipname}
```

To install the JavaScript client from a local tarball for a Mac or
Linux-based operating system, run the following command:

```sh
npm install lib/opendxl-dxl-client-<version>.tgz --save
```

To install the JavaScript client from a local tarball for Windows, run:

```sh
npm install lib\opendxl-dxl-client-<version>.tgz --save
```

To install the JavaScript client via the
[npm package registry](https://www.npmjs.com/package/@opendxl/dxl-client), run:

```sh
npm install @opendxl/dxl-client --save
```
