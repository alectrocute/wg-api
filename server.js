const config = require('./config.json')
var fs = require('fs')
var ini = require('ini')
const chalk = require('chalk')
const path = require('path')
const exec = require('child_process').exec
const fastify = require('fastify')({ logger: false })
fastify.register(require('fastify-static'), { root: path.join(__dirname) })

function cliMsg(msg, type) {
    if (type !== 1) {
        console.log(chalk.black.bgWhite("wg-api") + " " + msg)
    } else {
        console.log(chalk.black.bgWhite("wg-api") + " " + chalk.white.bgRed.bold(msg))
    }
}

function formatBytes(a, b) {
    if (0 == a) return "0 Bytes";
    var c = 1024,
        d = b || 2,
        e = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
        f = Math.floor(Math.log(a) / Math.log(c));
    return parseFloat((a / Math.pow(c, f)).toFixed(d)) + " " + e[f]
}

function formatTime(unixtimestamp) {
    var months_arr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    var date = new Date(unixtimestamp * 1000);
    var min = date.getMinutes().toString();
    var sec = date.getSeconds().toString();
    var resp = months_arr[date.getMonth()] +
        ' ' + date.getDate() + ', ' +
        date.getFullYear() + ' ' +
        date.getHours() + ':' +
        min.substr(-2) +
        ':' + sec.substr(-2) + " UTC"
    return resp;
}

function genError(code, msg) {
    var res = { code: code, msg: msg }
    return JSON.stringify(res, null, 2)
}

function authReq(req, reply, b) {
    var checkVal = false;
    if (config.allowedHosts.includes(req.ip)) {
        checkVal = true;
    }
    if (config.allowedHosts.includes("*")) {
        checkVal = true;
    }
    if (checkVal) {
        reply.send(JSON.stringify(b, null, 2))
    } else {
        reply.send(genError(500, "unauthenticated"))
    }
}

function authAction(req) {
    if (config.allowedHosts.includes(req.ip)) {
        return true
    }
    if (config.allowedHosts.includes("*")) {
        return true
    }
    cliMsg(`${req.ip} denied access, please note this activity.`)
    return false
}

fastify.get('/interface/info', function(req, reply) {
    cliMsg(`${req.ip} requested server overview`)
    exec('bash ./scripts/bash/json.sh', (err, stdout, stderr) => {
        var temp = {}
        temp.output = JSON.parse(stdout)
        for (var inf in temp.output) {
            temp.output[inf]['privateKey'] = "[hidden]"
            for (var key in temp.output[inf]['peers']) {
                temp.output[inf]['peers'][key]['transferRx'] = formatBytes(temp.output[inf]['peers'][key]['transferRx'], 3)
                temp.output[inf]['peers'][key]['transferTx'] = formatBytes(temp.output[inf]['peers'][key]['transferTx'], 3)
                temp.output[inf]['peers'][key]['latestHandshake'] = formatTime(Number(temp.output[inf]['peers'][key]['latestHandshake']))
            }
        }
        authReq(req, reply, temp.output)
    })
})

fastify.get('/peer/info/:username', function(request, reply) {
    cliMsg(`${request.ip} requested info of peer ${request.params.username}`)
    if (!authAction(request)) return
    try {
        var profile = ini.parse(fs.readFileSync('./profiles/' + request.params.username + '/wg0.conf', 'utf-8'))
        profile.qr = "/client/qr/" + request.params.username + ".png"
        reply.send(JSON.stringify({ code: 200, profile }, null, 2))
    } catch (error) {
        reply.send(JSON.stringify({ code: 404, error: "Profile not found" }, null, 2))
    }
})

fastify.get('/peer/create/:username', function(request, reply) {
    cliMsg(`${request.ip} requested new peer named ${request.params.username}`)
    if (!authAction(request)) return
    try {
        var profile = ini.parse(fs.readFileSync('./profiles/' + request.params.username + '/wg0.conf', 'utf-8'))
        profile.qr = "/client/qr/" + request.params.username + ".png"
        reply.send(JSON.stringify({ code: 500, error: "Profile already exists", profile }, null, 2))
    } catch (error) {
        exec('bash ./scripts/bash/wg.sh -a ' + request.params.username, (err, stdout, stderr) => {
            var profile = ini.parse(fs.readFileSync('./profiles/' + request.params.username + '/wg0.conf', 'utf-8'))
            profile.qr = "/client/qr/" + request.params.username + ".png"
            reply.send(JSON.stringify({ code: 200, profile }, null, 2))
        })
    }
})

fastify.get('/client/remove/:username', function(request, reply) {
    cliMsg(`${request.ip} requested removal of peer ${request.params.username}`)
    if (!authAction(request)) return
    exec(`bash ./scripts/bash/wg.sh -d ${request.params.username}`, (err, stdout, stderr) => {
        reply.send(JSON.stringify({ code: 200, profile: "Revoked" }, null, 2))
    });
})

fastify.get('/peer/qr/:username', function(request, reply) {
    cliMsg(`${request.ip} requested QR .png of peer ${request.params.username}`)
    if (!authAction(request)) return
    try {
        reply.sendFile(path.join("profiles", request.params.username, request.params.username + ".png"))
    } catch (error) {
        reply.send(JSON.stringify({ code: 404, error: "Profile not found." }, null, 2))
    }
})

fastify.get('/peer/plaintext/:username', function(request, reply) {
    cliMsg(`${request.ip} requested plaintext cert of peer ${request.params.username}`)
    if (!authAction(request)) return
    try {
        reply.sendFile(path.join("profiles", request.params.username, "wg0.conf"))
    } catch (error) {
        reply.send(JSON.stringify({ code: 404, error: "Profile not found." }, null, 2))
    }
})

fastify.listen(config.listen.port, config.listen.host, err => {
    if (err) throw err
    cliMsg(`Now listening on ${config.listen.host}:${fastify.server.address().port}`)
    cliMsg(`This endpoint is very insecure! Make sure you reverse-proxy it and properly configure allowed hosts.`, 1)
})