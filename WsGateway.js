"use strict";
var WebSocketServer = require("ws").Server;
var EventEmitter = require("events");

class WsGateway extends EventEmitter {
    static get ERROR() {
        return "error";
    }
    static get CLOSE() {
        return "close";
    }
    static get START() {
        return "start";
    }
    static get CONNECT() {
        return "connect";
    }
    static get MESSAGE() {
        return "message";
    }
    /**
     * 
     * @param opt : Options
     * @param basicAuth : Basic Auth
     * @param onConnectAuth : On Connection Auth
     */
    constructor(options, basicAuth, onConnectAuth) {
        super();
        this.origin = options.origin;
        this.port = options.port;
        this.hashKey = options.hashKey == null ? "hash=" : options.hashKey;
        this.ws = null;
        this.handlers = {};
        var self = this;
        this.basicAuth = basicAuth != null ? basicAuth : function (info, done) {
            var origin;
            try {
                origin = info.req.headers.origin;
            } catch (e) {
                return done(false);
            }
            if (origin !== self.origin)
                return done(false);
            return done(true);
        }
        this.onConnectAuth = onConnectAuth != null ? onConnectAuth : function (gw, cb) {
            var hash;
            try {
                const cookie = gw.upgradeReq.headers.cookie;
                hash = cookie.replace(self.hashKey, "");
            } catch (e) {
                cb(e);
                return;
            }
            if (hash == null) {
                cb("Hash not find");
                return;
            }
            cb(null, hash);
        };
    }
    addHandler(code, container) {
        container.Code = code;
        this.handlers[code] = container.RequestHandler;
    }
    start() {
        this.ws = new WebSocketServer({ port: this.port, verifyClient: this.basicAuth });
        var self = this;
        this.ws.on("connection",
            function (ws) {
                self.onConnectAuth(ws, function (error, user) {
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
                                self.emit(WsGateway.ERROR, e, ws, user);
                                return;
                            }
                            const handler = self.handlers[target];
                            if (!handler) {
                                self.emit(WsGateway.MESSAGE, user, target, method, packet, data);
                                return;
                            }
                            handler(user, method, packet, data, function (t, m, p) {
                                try {
                                    ws.send(Buffer.concat([self.getHeader(t, m, p), d]));
                                } catch (e) {
                                    self.emit(WsGateway.ERROR, e, ws, user);
                                }
                            });
                        });
                    ws.on("close", function (c, m) {
                        self.emit(WsGateway.CLOSE, c, m, user);
                    });
                    ws.on("error", function (e) {
                        self.emit(WsGateway.ERROR, e, ws, user);
                    });
                    self.emit(WsGateway.CONNECT, ws, user);
                });

            });
        this.emit(WsGateway.START, this);
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