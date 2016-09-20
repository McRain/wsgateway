"use strict";
var WebSocketServer = require("ws").Server;
var EventEmitter = require("events");

class WsGateway extends EventEmitter {
    constructor(opt, verify) {
        super();
        this.ws = null;
        this.handlers = {};
        this.origin = opt.origin;
        this.port = opt.port;
        this.hashKey = opt.hashKey == null ? "hash=" : opt.hashKey;
        var self = this;
        this.verify = verify != null ? verify : function (info, done) {
            var origin;
            try {
                origin = info.req.headers.origin;
            } catch (e) {
                return done(false);
            } 
            if (origin!== self.origin)
                return done(false);
            return done(true);
        }
    }
    addHandler(code, container) {
        container.Code = code;
        this.handlers[code] = container.RequestHandler;
    }
    start(auth) {
        this.ws = new WebSocketServer({ port: this.port, verifyClient: this.verify });
        var self = this;
        this.ws.on("connection",
            function (ws) {
                ws.platform = self.platform;
                var hash;
                try {
                    const cookie = ws.upgradeReq.headers.cookie;
                    hash = cookie.replace(self.hashKey, "");
                } catch (e) {
                    self.emit("error", e, ws);
                    return;
                }
                if (hash == null) {
                    self.emit("error", "Hash not find", ws);
                    return;
                }
                auth(hash, function (error, user) {
                    if (error)
                        return;
                    ws.on("message",
                        function (message, arg) {
                            var target, method, packet, data;
                            try {
                                target = message[0];
                                method = message[1];
                                packet = message.readInt32LE(2);
                                data = message.slice(8);
                            } catch (e) {
                                self.emit("error", e, ws, user);
                                return;
                            }
                            const handler = self.handlers[target];
                            if (!handler) {
                                self.emit("error", `Recived unknow target ${target}`, ws, user);
                                return;
                            }
                            handler(user, method, packet, data, function (t, m, p, d) {
                                try {
                                    ws.send(Buffer.concat([self.getHeader(t, m, p), d]));
                                } catch (e) {
                                    self.emit("error", e, ws, user);
                                }
                            });
                        });
                    ws.on("close", function (c, m) {
                        self.emit("close", ws, user, c, m);
                    });
                    ws.on("error", function (e) {
                        self.emit("error", e, ws, user);
                    });
                    self.emit("connect", ws, user);
                });
            });
        this.emit("start", this);
    }
    stop() {

    }
    getHeader(t, m, p) {
        const buffer = Buffer.allocUnsafe(8);
        buffer[0] = t;
        buffer[1] = m;
        buffer.writeInt32LE(p != null ? p : 0, 2);
        return buffer;
    }
}
module.exports = WsGateway;