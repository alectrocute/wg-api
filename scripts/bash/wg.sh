#!/usr/bin/env bash

cd `dirname ${BASH_SOURCE[0]}`

. ../data/wg.def
CLIENT_TPL_FILE=../data/client.conf.tpl
SERVER_TPL_FILE=../data/server.conf.tpl
SAVED_FILE=../data/tmp/saved.tmp
AVAILABLE_IP_FILE=../data/tmp/available_ip.tmp
WG_TMP_CONF_FILE=../data/tmp/$_INTERFACE.conf.tmp
WG_CONF_FILE="/etc/wireguard/$_INTERFACE.conf"

dec2ip() {
    local delim=''
    local ip dec=$@
    for e in {3..0}
    do
        ((octet = dec / (256 ** e) ))
        ((dec -= octet * 256 ** e))
        ip+=$delim$octet
        delim=.
    done
    printf '%s\n' "$ip"
}

generate_cidr_ip_file_if() {
    local cidr=${_VPN_NET}
    local ip mask a b c d

    IFS=$'/' read ip mask <<< "$cidr"
    IFS=. read -r a b c d <<< "$ip"
    local beg=$((a * 256 ** 3 + b * 256 ** 2 + c * 256 + d))
    local end=$(( beg+(1<<(32-mask))-1 ))
    ip=$(dec2ip $((beg+1)))
    _SERVER_IP="$ip/$mask"
    if [[ -f $AVAILABLE_IP_FILE ]]; then
        return
    fi

    > $AVAILABLE_IP_FILE
    local i=$((beg+2))
    while [[ $i -lt $end ]]; do
        ip=$(dec2ip $i)
	echo "$ip/$mask" >> $AVAILABLE_IP_FILE
        i=$((i+1))
    done
}

get_vpn_ip() {
    local ip=$(head -1 $AVAILABLE_IP_FILE)
    if [[ $ip ]]; then
	local mat="${ip/\//\\\/}"
        sed -i "/^$mat$/d" $AVAILABLE_IP_FILE
    fi
    echo "$ip"
}

add_user() {
    local user=$1
    local template_file=${CLIENT_TPL_FILE}
    local interface=${_INTERFACE}
    local userdir="../../profiles/$user"

    mkdir -p "$userdir"
    wg genkey | tee $userdir/privatekey | wg pubkey > $userdir/publickey

    # client config file
    _PRIVATE_KEY=`cat $userdir/privatekey`
    _VPN_IP=$(get_vpn_ip)
    if [[ -z $_VPN_IP ]]; then
        echo -e "\e[44m[wg-api cli]\e[0m No available IP"
        exit 1
    fi
    _TABLE=auto
    if [[ ! -z "$route" ]]; then
	_TABLE=off
    fi
    eval "echo \"$(cat "${template_file}")\"" > $userdir/wg0.conf
    qrencode -o $userdir/$user.png  < $userdir/wg0.conf

    # change wg config
    local ip=${_VPN_IP%/*}/32
    if [[ ! -z "$route" ]]; then
	ip="0.0.0.0/0,::/0"
    fi
    local public_key=`cat $userdir/publickey`
    wg set $interface peer $public_key allowed-ips $ip
    if [[ $? -ne 0 ]]; then
        echo "wg set failed"
        rm -rf $user
        exit 1
    fi

    echo -e "\e[44m[wg-api cli]\e[0m Created $user"
}

del_user() {
    local user=$1
    local userdir="../../profiles/$user"
    local ip key
    local interface=${_INTERFACE}

    read ip key <<<"$(awk "/^$user /{print \$2, \$3}" ${SAVED_FILE})"
    if [[ -n "$key" ]]; then
        wg set $interface peer $key remove
        if [[ $? -ne 0 ]]; then
            echo "wg set failed"
            exit 1
        fi
    fi
    sed -i "/^$user /d" ${SAVED_FILE}
    if [[ -n "$ip" ]]; then
        echo "$ip" >> ${AVAILABLE_IP_FILE}
    fi
    rm -rf $userdir && echo -e "\e[44m[wg-api cli]\e[0m Revoked $user"
}

generate_and_install_server_config_file() {
    local template_file=${SERVER_TPL_FILE}
    local ip

    # server config file
    eval "echo \"$(cat "${template_file}")\"" > $WG_TMP_CONF_FILE
    while read user vpn_ip public_key; do
        ip=${vpn_ip%/*}/32
        if [[ ! -z "$route" ]]; then
            ip="0.0.0.0/0,::/0"
        fi
        cat >> $WG_TMP_CONF_FILE <<EOF
[Peer]
PublicKey = $public_key
AllowedIPs = $ip
EOF
    done < ${SAVED_FILE}
    \cp -f $WG_TMP_CONF_FILE $WG_CONF_FILE
}

clear_all() {
    local interface=$_INTERFACE
    wg-quick down $interface
    > $WG_CONF_FILE
    rm -f ${SAVED_FILE} ${AVAILABLE_IP_FILE}
}

do_user() {
    generate_cidr_ip_file_if

    if [[ $action == "-a" ]]; then
        if [[ -d $user ]]; then
            echo "$user exist"
            exit 1
        fi
        add_user $user
    elif [[ $action == "-d" ]]; then
        del_user $user
    fi

    generate_and_install_server_config_file
}

init_server() {
    local interface=$_INTERFACE
    local template_file=${SERVER_TPL_FILE}

    if [[ -s $WG_CONF_FILE ]]; then
        echo "$WG_CONF_FILE exist"
	exit 1
    fi
    generate_cidr_ip_file_if
    eval "echo \"$(cat "${template_file}")\"" > $WG_CONF_FILE
    chmod 600 $WG_CONF_FILE
    wg-quick up $interface
}

list_user() {
    cat ${SAVED_FILE}
}

usage() {
    echo "usage: $0 [-a|-d|-c|-g|-i] [username] [-r]

    -i: init server conf
    -a: add user
    -d: del user
    -l: list all users
    -c: clear all
    -g: generate ip file
    -r: enable router(allow 0.0.0.0/0)
    "
}

# main
if [[ $EUID -ne 0 ]]; then
   echo -e "\e[44m[wg-api cli]\e[0m This script needs to be run as root"
    exit 1
fi

action=$1
user=$2
route=$3

if [[ $action == "-i" ]]; then
    init_server
elif [[ $action == "-c" ]]; then
    clear_all
elif [[ $action == "-l" ]]; then
    list_user
elif [[ $action == "-g" ]]; then
    generate_cidr_ip_file_if
elif [[ ! -z "$user" && ( $action == "-a" || $action == "-d" ) ]]; then
    do_user
else
    usage
    exit 1
fi
