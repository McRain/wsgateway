# WsGateway

# This repository is archived - please use https://github.com/McRain/reneos.server

Easy and simple tools for creating gateways to communicate between client and server to use websocket and node.js.

### Installing

```
npm install --save wsgateway
```

For an example, see the catalog "Examples"

### Base use as server

```js
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
```

### Base use as client

```js
let WsGateway = require("wsgateway");

let options = {
    "ip":"127.0.0.1",
    "origin": "ws://origin.test",
    "port": 4800,
    "hash": "secretKey"
};


let client = new WsGateway(options);
client.on(WsGateway.CONNECT, function (dt) {
    console.log("Connected to server");
    client.send(1, 1, 0, Buffer.from("Test message from client"));
});
client.on(WsGateway.MESSAGE, function() {
    console.log("Message from server");
});
client.on(WsGateway.ERROR, function (err, socket) {
    console.log(`Client error :${err}`);
});
client.on(WsGateway.CLOSE, function () {
    console.log(`Client lose connection`);
});
client.connect();
```
