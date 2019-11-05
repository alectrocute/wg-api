[Interface]
Address = $_VPN_IP
PrivateKey = $_PRIVATE_KEY
Table = $_TABLE

[Peer]
PublicKey = $_SERVER_PUBLIC_KEY
AllowedIPs = 0.0.0.0/0
Endpoint = $_SERVER_LISTEN
