"use strict";
var WebSocket = require("ws");
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
    constructor(opt, basicAuth, onConnectAuth) {
        super();
        this.ip = opt.ip;//for client
        this.origin = opt.origin;
        this.port = opt.port;
        this.hashKey = opt.hash != null ? opt.hash : opt.hashKey != null ? opt.hashKey : "hash=";
        this.ws = null;
        this.handlers = {};
        var self = this;
        if (this.ip == null) {//server
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
            return;
        }
        //is client
        this.onConnectAuth = onConnectAuth != null ? onConnectAuth : function (message, arg) {
            self.messageParser(self.socket, self.user, message, arg);
        };
        this.basicAuth = basicAuth != null ? basicAuth : function () {
            self.socket.on("message", self.onConnectAuth);
        };
    }
    addHandler(code, container) {
        container.Code = code;
        this.handlers[code] = container.RequestHandler;
    }
    /**
     * Server start
     */
    start() {
        this.ws = new WebSocket.Server({ port: this.port, verifyClient: this.basicAuth });
        var self = this;
        this.ws.on("connection",
            function (ws) {
                self.onConnectAuth(ws, function (error, user) {
                    if (error)
                        return;
                    ws.on("message", function (msg, arg) {
                        self.messageParser(ws, user, msg, arg);
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
    /**
     * Client connect
     */
    connect() {
        var self = this;
        this.socket = new WebSocket(`ws:${this.ip}:${this.port}`, this.hashKey);
        this.socket.on("open", function (a1, a2, a3) {
            self.emit(WsGateway.CONNECT, self);
            self.user = self.socket;
            self.basicAuth();
        });
    }
    send(target, method, packet, buffer) {
        if (this.socket == null || this.socket.readyState !== 1/*WebSocket.OPEN*/) return;
        try {
            var header = this.getHeader(target, method, packet);
            var buff = Buffer.concat([header, buffer]);
            this.socket.send(buff, { binary: true, mask: true });
        } catch (e) {
            this.emit(WsGateway.ERROR, e, this.socket, this.user);
        }
    }
    stop() {
        if (this.ws != null)
            this.ws.close();
    }
    messageParser(socket, user, message, arg) {
        var target, method, packet, data;
        try {
            target = message[0];
            method = message[1];
            packet = message.readInt32LE(2);
            data = message.slice(8);
        } catch (e) {
            this.emit(WsGateway.ERROR, e, socket, user);
            return;
        }
        const handler = this.handlers[target];
        if (!handler) {
            this.emit(WsGateway.MESSAGE, user, target, method, packet, data);
            return;
        }
        handler(user, method, packet, data, function (t, m, p) {
            try {
                socket.send(Buffer.concat([this.getHeader(t, m, p), d]));
            } catch (e) {
                this.emit(WsGateway.ERROR, e, socket, user);
            }
        });
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