The OpenDXL JavaScript Client's command line interface supports the
`provisionconfig` operation which generates the information necessary for a
client to connect to a DXL fabric (certificates, keys, and broker information).

As part of the provisioning process, a remote call will be made to a
provisioning server (ePO or OpenDXL Broker) which contains the Certificate
Authority (CA) that will sign the client's certificate.

> **Note:** ePO-managed environments must have 4.0 (or newer) versions of
> DXL ePO extensions installed.

Here is an example usage of `provisionconfig` operation for a Mac or Linux-based
operating system:

```sh
node_modules/.bin/dxlclient config myserver client1
```

For Windows, the equivalent command would be:

```sh
node_modules\.bin\dxlclient config myserver client1
```

The parameters are as follows:

* `config` is the directory to contain the results of the provisioning
  operation.
* `myserver` is the host name or IP address of the server (ePO or OpenDXL
  Broker) that will be used to provision the client.
* `client1` is the value for the Common Name (CN) attribute stored in the
  subject of the client's certificate.

> **Note:** If a non-standard port (not 8443) is being used for ePO or the
> management interface of the OpenDXL Broker, an additional "port" argument
> must be specified. For example ``-t 443`` could be specified as part of the
> provision operation to connect to the server on port 443.

If you encounter an error with the message
`Unable to find openssl from system path`, ensure that you have installed
OpenSSL per the instructions in the
[prerequisites section]{@tutorial installation}. The CLI tool attempts to
locate the openssl executable from your environment variable `PATH`. If you
have installed openssl in a location which is not listed in your `PATH`
environment variable, you can also provide the path to the openssl executable
as a separate parameter. For example:

```sh
node_modules\.bin\dxlclient --opensslbin D:\custom\openssl.exe config myserver client1
```

When prompted, provide credentials for the OpenDXL Broker Management Console
or ePO (the ePO user must be an administrator):

```sh
Enter server username:
Enter server password:
```

On success, output similar to the following should be displayed:

```sh
Saving private key file to config/client.key
Saving csr file to config/client.csr
Saving DXL config file to config/dxlclient.config
Saving ca bundle file to config/ca-bundle.crt
Saving client certificate file to config/client.crt
```

As an alternative to prompting, the username and password values can be
specified via command line options:

```sh
node_modules/.bin/dxlclient provisionconfig config myserver client1 -u myuser -p mypass
```

See the {@tutorial advanced-cli-provisioning} section for advanced
`provisionconfig` operation options.
