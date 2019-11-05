// wg-api config json
const config = require('./config.json')

var fs = require('fs')
var ini = require('ini')
const path = require('path')
const exec = require('child_process').exec
const fastify = require('fastify')({
    logger: false
})

fastify.register(require('fastify-static'), {
    root: path.join(__dirname),
})

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
        ':' + sec.substr(-2) + " UTC";
    return resp;
}

function genError(code, msg) {
    var res = { code: code, msg: msg }
    return JSON.stringify(res, null, 2);
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
        return true;
    }
    if (config.allowedHosts.includes("*")) {
        return true;
    }
    return false;
}

fastify.get('/info', function(req, reply) {
    exec('bash ./scripts/json.sh', (err, stdout, stderr) => {
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

fastify.get('/client/info/:username', function(request, reply) {
    if (!authAction(request)) return;
    try {
        var profile = ini.parse(fs.readFileSync('./profiles/' + request.params.username + '/client.conf', 'utf-8'))
        profile.qr = "/client/qr/" + request.params.username + ".png"
        reply.send(JSON.stringify({ code: 200, profile }, null, 2))
    } catch (error) {
        reply.send(JSON.stringify({ code: 404, error: "Profile not found" }, null, 2))
    }
})

fastify.get('/client/create/:username', function(request, reply) {
    if (!authAction(request)) return;
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
    if (!authAction(request)) return;
    exec(`bash ./scripts/bash/wg.sh -d ${request.params.username}`, (err, stdout, stderr) => {
        reply.send(JSON.stringify({ code: 200, profile: "Revoked" }, null, 2))
    });



})

fastify.get('/client/qr/:username', function(request, reply) {
    if (!authAction(request)) return;
    try {
        reply.sendFile(path.join("profiles", request.params.username, request.params.username + ".png"))
    } catch (error) {
        reply.send(JSON.stringify({ code: 404, error: "Profile not found." }, null, 2))
    }
})

fastify.get('/client/plaintext/:username', function(request, reply) {
    if (!authAction(request)) return;
    try {
        reply.sendFile(path.join("profiles", request.params.username, "wg0.conf"))
    } catch (error) {
        reply.send(JSON.stringify({ code: 404, error: "Profile not found." }, null, 2))
    }
})


fastify.listen(config.listen.port, config.listen.host, err => {
    if (err) throw err
    console.log(`wg-api listening on ${config.listen.host}:${fastify.server.address().port}`)
})