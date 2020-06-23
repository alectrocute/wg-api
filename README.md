![logo](https://github.com/alectrocute/wg-api/blob/master/icon.png)

wg-api is an API endpoint for a Wireguard® VPN server. It allows you to make HTTP GET requests with JSON responses, enabling you to create & revoke peers (eg. clients), access QR/plaintext/JSON config files and receive realtime server info.

It also currently includes an installer script to configure your Wireguard® interface correctly as per wg-api's construction.

It's still a baby project but I plan on building it out into a full-featured RESTful API for this amazing VPN software. I would **NOT** use this in production for awhile. It is a very insecure endpoint that could and most likely **will** give an attacker access to your user's keys and full control over your system. The only thing securing it currently is an IP-based whitelist in `config.json`. Seriously, don't even think about exposing this as a public IP and/or port.

## Installation

Use a fresh Ubuntu 18.* install with up-to-date apt dependencies, with Node and NPM installed and Wireguard uninstalled.
```bash
apt-get install nodejs npm -y
git clone https://github.com/alectrocute/wg-api
cd wg-api
npm install fastify fastify-static chalk ini
cd ./scripts/bash
./installer.sh
```

Take time to configure the options in `/wg-api/scripts/data/wg.def` and `/wg-api/config.json`.

Then get your Wireguard® server up and running:

```bash
cd ./wg-api/scripts/bash
./wg.sh -i
```

## Running the server

```bash
node server.js
```

## API endpoints

### GET /interface/info

Will return a JSON object of all Wireguard® interface stats:

```json
{
  "wg0": {
    "privateKey": "[hidden]",
    "publicKey": "dutH7c8K2VX4OcQ1c/rvIAAFJBRcf2a9ieVmq2GI4UA=",
    "listenPort": 27953,
    "peers": {
      "EobS6jP7+b4jqI1o97PAjp8rhLBpmD9hSbcnhLRqcTQ=": {
        "endpoint": "12.34.45.545:21807",
        "latestHandshake": "Nov 5, 2019 3:23:3 UTC",
        "transferRx": "3.034 MB",
        "transferTx": "21.65 MB",
        "allowedIps": [
          "10.9.0.6/32"
        ]
      }
    }
  }
}
```

### GET /peer/create/[nickname]

Will generate a new peer, assign IP, etc. based on customized template and return JSON of their details:

```json
{
  "code": 200,
  "profile": {
    "Interface": {
      "Address": "10.9.0.7/24",
      "PrivateKey": "eOksCc/sE+MYmHBlXc9t4ZPpIdBcB94Bgbip12gbEVI=",
      "DNS": "1.1.1.1, 1.0.0.1"
    },
    "Peer": {
      "PublicKey": "dutH7c8K2VX4OcQ1c/rvIAAFJBRcf2a9ieVmq2GI4UA=",
      "AllowedIPs": "0.0.0.0/0, ::/0",
      "Endpoint": "45.76.174.177:27953",
      "PersistentKeepalive": "25"
    },
    "qr": "/peer/qr/alec2"
  }
}
```

### GET /peer/remove/[nickname]

Will revoke a peer, remove all associated files, reload the interface and return a basic message:

```json
{
  "code": 200,
  "profile": "Revoked"
}
```

### GET /peer/qr/[nickname]

Will return a PNG image of a Wireguard® peer's QR code.


### GET /peer/info/[nickname]

Will return a JSON object of a Wireguard® peer's stats:

```json
 {
  "code": 200,
  "profile": {
    "Interface": {
      "Address": "10.9.0.6/24",
      "PrivateKey": "8PZh0lf2lZ0CB8i585ei2ZYcCBruZGKubiRgt+b3NGA=",
      "DNS": "1.1.1.1, 1.0.0.1"
    },
    "Peer": {
      "PublicKey": "dutH7c8K2VX4OcQ1c/rvIAAFJBRcf2a9ieVmq2GI4UA=",
      "AllowedIPs": "0.0.0.0/0, ::/0",
      "Endpoint": "12.34.56.343:27953",
      "PersistentKeepalive": "25"
    },
    "qr": "/peer/qr/alec"
  }
}
```

### GET /peer/plaintext/[nickname]

Will return a INI-formatted plaintext document of a Wireguard® peer's configuration file:

```ini
[Interface]
Address = 10.9.0.6/24
PrivateKey = PZh0lf2lZ0CB8i585ei2ZYcCBruZGKubiRgt+b3NGA=
DNS = 1.1.1.1, 1.0.0.1

[Peer]
PublicKey = dutH7c8K2VX4OcQ1c/rvIAAFJBRcf2a9ieVmq2GI4UA=
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = 12.34.56.343:27953
PersistentKeepalive = 25
```

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
[MIT](https://choosealicense.com/licenses/mit/)
