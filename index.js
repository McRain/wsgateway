"use strict";
var WebSocket = require("ws");
var EventEmitter = require("events");

/**
 * Small helper in creating gateways to communicate between client and server.
 */
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
     * @param basicAuth : Basic Auth by origin
     * @param onConnectAuth : Extend Auth by cookie
     */
    constructor(opt, basicAuth, extendAuth, headers) {
        super();
        this.ip = opt.ip;//for client
        this.origin = opt.origin;
        this.port = opt.port;
        this.hashKey = opt.hash != null ? opt.hash : opt.hashKey != null ? opt.hashKey : "hash=";
        this.handlers = {};
        this.socket = null;//в сервере и клиенте - общий websocket
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
            this.extendAuth = extendAuth != null ? extendAuth : function (gw, cb) {
                var hash;
                try {
                    hash = gw.upgradeReq.headers["sec-websocket-protocol"];
                } catch (e) {
                    cb(e);
                    return;
                }
                if (hash == null) {
                    cb("Hash not find");
                    return;
                }
                cb(null, {});
            };
            return;
        }
        //is client - use extendAuth as message reader
        this.extendAuth = extendAuth != null ? extendAuth : function (message, arg) {
            self.messageParser(self.socket,self, self.socket, message, arg);
        };
        this.basicAuth = basicAuth != null ? basicAuth : function () {
            self.socket.on("message", self.extendAuth);
        };
        this.headers = headers;
    }
    addHandler(code, container) {
        container.Code = code;
        this.handlers[code] = container.RequestHandler;
    }
    /**
     * Server start
     */
    start() {
        this.socket = new WebSocket.Server({ port: this.port, verifyClient: this.basicAuth });
        var self = this;
        this.socket.on("connection",
            function (ws) {
                self.extendAuth(ws, function (error, user) {
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
        var op = { "origin": this.origin };
        if (this.headers != null)
            op.headers = this.headers;
        this.socket = new WebSocket(`ws:${this.ip}:${this.port}`, this.hashKey, op);
        this.socket.on("open", function (a1, a2, a3) {
            self.emit(WsGateway.CONNECT, self);
            self.basicAuth();
        });
    }
    sendTo(socket, target, method, packet, buffer) {
        if (socket == null || socket.readyState !== 1/*WebSocket.OPEN*/) return;
        const self = this;
        if (buffer == null)
            buffer = Buffer.allocUnsafe(0);
        try {
            const header = this.getHeader(target, method, packet);
            const buff = Buffer.concat([header, buffer]);
            socket.send(buff, { binary: true, mask: true }, function (error) {
                if (error != null)
                    self.emit(WsGateway.ERROR, error, socket);
            });
        } catch (e) {
            this.emit(WsGateway.ERROR, e, socket);
        }
    }
    send(target, method, packet, buffer) {
        this.sendTo(this.socket, target, method, packet, buffer);
    }
    stop() {
        if (this.socket != null)
            this.socket.close();
    }
    messageParser(socket, user, message, arg) {
        let target;
        let method;
        let packet;
        let data;
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
        var self = this;
        handler(user, method, packet, data, function (t, m, p, d) {
            try {
                socket.send(Buffer.concat([self.getHeader(t, m, p), d]), { binary: true, mask: true }, function (error) {
                    if (error != null)
                        self.emit(WsGateway.ERROR, error, socket);
                });
            } catch (e) {
                self.emit(WsGateway.ERROR, e, socket, user);
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