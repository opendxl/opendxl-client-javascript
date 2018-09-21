This page contain details regarding the advanced usage of the `provisionconfig`
operation.

Refer to {@tutorial basic-cli-provisioning} for basic usage details.

### Additional Certificate Signing Request (CSR) Information

Attributes other than the Common Name (CN) may also optionally be provided for
the CSR subject.

For example:

```sh
node_modules/.bin/dxlclient provisionconfig config myserver client1 --country US --state-or-province Oregon --locality Hillsboro --organization Engineering --organizational-unit "DXL Team" --email-address dxl@mcafee.com
```

By default, the CSR does not include any Subject Alternative Names. To include
one or more entries of type `DNS Name`, provide the `-s` option.

For example:

```sh
node_modules/.bin/dxlclient provisionconfig config myserver client1 -s client1.myorg.com -s client1.myorg.net
```

### Encrypting the Client's Private Key

The private key file which the `provisionconfig` operation generates can
optionally be encrypted with a passphrase.

For example:

```sh
node_modules/.bin/dxlclient provisionconfig config myserver client1 --passphrase
```

If the passphrase is specified with no trailing option (as above), the
provision operation prompts for the passphrase to be used:

```sh
Enter private key passphrase:
```

The passphrase can alternatively be specified as an additional argument
following the `--passphrase` argument, in which case no prompt is displayed.

For example:

```sh
node_modules/.bin/dxlclient provisionconfig config myserver client1 --passphrase itsasecret
```

> **Note:** The OpenDXL JavaScript client does not currently provide a method
> to specify the passphrase to be used for decrypting the private key used when
> connecting to a DXL fabric.

### Additional Options

The provision operation assumes that the default web server port is 8443, the
default port under which the ePO web interface and OpenDXL Broker Management
Console is hosted.

A custom port can be specified via the `-t` option.

For example:

```sh
node_modules/.bin/dxlclient provisionconfig config myserver client1 -t 443
```

The provision operation stores each of the certificate artifacts (private key,
CSR, certificate, etc.) with a base name of `client` by default. To use an
alternative base name for the stored files, use the `-f` option.

For example:

```sh
node_modules/.bin/dxlclient provisionconfig config myserver client1 -f theclient
```

The output of the command above should appear similar to the following:

```sh
Saving private key file to config/theclient.key
Saving csr file to config/theclient.csr
Saving DXL config file to config/dxlclient.config
Saving ca bundle file to config/ca-bundle.crt
Saving client certificate file to config/theclient.crt
```

If the management server's CA certificate is stored in a local CA truststore
file &mdash; one or more PEM-formatted certificates concatenated together into a
single file &mdash; the provision operation can be configured to validate the
management server's certificate against that truststore during TLS session
negotiation by supplying the `-e` option.

The name of the truststore file should be supplied along with the option:

```sh
node_modules/.bin/dxlclient provisionconfig config myserver -e config/ca-bundle.crt
```

### Generating the CSR Separately from Signing the Certificate

By default, the `provisionconfig` command generates a CSR and immediately sends
it to a management server for signing. Certificate generation and signing could
alternatively be performed as separate steps &mdash; for example, to enable a
workflow where the CSR is signed by a certificate authority at a later time.

The `generatecsr` operation can be used to generate the CSR and private key
without sending the CSR to the server.

For example:

```sh
node_modules/.bin/dxlclient generatecsr config client1
```

The output of the command above should appear similar to the following:

```sh
Saving private key file to config/client.key
Saving csr file to config/client.csr
```

Note that the `generatecsr` operation has options similar to those available
in the `provisionconfig` operation for including additional subject attributes
and/or subject alternative names in the generated CSR and for encrypting the
private key.

See the "Additional Certificate Signing Request (CSR) Information" and
"Encrypting the Client's Private Key" sections above for more information.

If the `provisionconfig` operation includes a `-r` option, the
`common_or_csrfile_name` argument is interpreted as the name of a CSR file to
load from disk rather than the Common Name to insert into a new CSR file.

For example:

```sh
node_modules/.bin/dxlclient provisionconfig config myserver config/client.csr -r
```

In this case, the command line output shows that the certificate and
configuration-related files received from the server are stored but no
new private key or CSR file is generated:

```sh
Saving DXL config file to config/dxlclient.config
Saving ca bundle file to config/ca-bundle.crt
Saving client certificate file to config/client.crt
```
