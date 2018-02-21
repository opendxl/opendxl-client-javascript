### Prerequisites

To use the OpenDXL JavaScript Client (Node.js) the following prerequisites must
be satisfied:

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

* If you intend to use the
  [OpenDXL JavaScript CLI tool]{@tutorial basic-cli-provisioning} for
  provisioning, you must ensure that an OpenSSL executable (separate from
  Node.js itself) is installed. The CLI tool uses OpenSSL to generate private
  keys and certificate signing requests.

  For Windows, OpenSSL can be downloaded from the following location:

  <http://www.slproweb.com/products/Win32OpenSSL.html>

  Select the Win32 OpenSSL Light or Win64 OpenSSL Light package, depending on
  your architecture (32-bit or 64-bit).

  If a message occurs during setup indicating `...critical component is
  missing: Microsoft Visual C++ 2008 Redistributables`, cancel the setup
  and download one of the following packages (based on your architecture):

  * Visual C++ 2008 Redistributables (x86), available at:

    <http://www.microsoft.com/downloads/details.aspx?familyid=9B2DA534-3E03-4391-8A4D-074B9F2BC1BF>

  * Visual C++ 2008 Redistributables (x64), available at:

    <http://www.microsoft.com/downloads/details.aspx?familyid=bd2a6171-e2d6-4230-b809-9a8d7548c1b6>

### Installation

Before installing the OpenDXL JavaScript Client (Node.js), change to the
directory which you extracted from the SDK zip file. For example:

```sh
cd {@releasezipname}
```

To install the client from a local tarball for a Mac or Linux-based operating
system, run the following command:

```sh
npm install ./lib/{@releasetarballname} --save
```

To install the client from a local tarball for Windows, run:

```sh
npm install .\lib\{@releasetarballname} --save
```

To install the client via the
[npm package registry](https://www.npmjs.com/package/@opendxl/dxl-client), run:

```sh
npm install @opendxl/dxl-client --save
```
