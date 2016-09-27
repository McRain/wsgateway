let WsGateway = require("wsgateway");
let connections = [];
let options = {
    "origin": "ws://origin.test",
    "port": 4800,
    "hash": "secretKey"
};

const gateway = new WsGateway(options);
gateway.on("start", function (w) {
    console.log(`Gateway start. Port:${gateway.port} origin:${gateway.origin} hashkey:${gateway.hashKey}`);
});
gateway.on("error", function (e) {
    console.log(`Gateway error:${e}`);
});
gateway.on("close", function (c, m) {
    console.log(`Gateway disconnect(${c}):${m}`);
});
gateway.on("connect", function (gw, u) {
    u.socket = gw;
    u.name = "User 1";
    connections.push(u);
    console.log(`Client ${u.name} from ${gw.upgradeReq.connection.remoteAddress} connected`);
});
gateway.on("message", function (u, target, method, packet, data) {
    console.log(u.name + ": " + data);
    gateway.sendTo(u.socket, target, method, packet, Buffer.from("This is server answer "));
});
gateway.start();