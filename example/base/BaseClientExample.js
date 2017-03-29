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