[Interface]
Address = $_VPN_IP
PrivateKey = $_PRIVATE_KEY
DNS = 1.1.1.1, 1.0.0.1

[Peer]
PublicKey = $_SERVER_PUBLIC_KEY
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = $_SERVER_LISTEN
PersistentKeepalive = 25

