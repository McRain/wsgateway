"use strict";
var WebSocketServer = require("ws").Server;
var EventEmitter = require("events");

class WsGateway extends EventEmitter{
    constructor(opt,verify) {
        super();
        this.ws = null;
        this.handlers = {};
        this.options = {
            debug:true,port:30001,debugKey:"",hashkey:"hash"
        };
        var self = this;
        if (opt!=null)
        Object.keys(opt).forEach(function (k) {
            self.options[k] = opt[k];
        });
        this.verify = verify != null ? verify : function (info, done) {
            return done(true);
        }
    }
    addHandler(code, container) {
        container.Code = code;
        this.handlers[code] = container.RequestHandler;
    }
    start() {
        this.ws = new WebSocketServer({ port: this.options.port, verifyClient: this.verify });
        var self = this;
        this.ws.on("connection",
            function (ws) {
                var hash;
                try {
                    const cookie = ws.upgradeReq.headers.cookie;
                    hash = cookie.replace(self.options.hashkey+"=", "");
                } catch (e) {
                    self.emit("error", e, ws);
                    return;
                }
                if (hash == null) {
                    self.emit("error", "hash not find",  ws);
                    return;
                }
                self.emit("open", hash, ws, function(error, user) {
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
                                self.emit("error", `recived unknow target ${target}`, ws, user);
                                return;
                            }
                            handler(user, method, packet, data, function (t, m, p, d) {
                                ws.send(Buffer.concat([self.getHeader(t, m, p), d]));
                            });
                        });
                    ws.on("close", function (c, m) {
                        self.emit("close",ws,user, c, m);
                    });
                    ws.on("error", function (e) {
                        self.emit("error",e, ws, user);
                    });
                    self.emit("connect", ws, user);
                });
            });
        this.emit("start", this);
    }
    stop() {
        
    }
    getHeader(t,m,p) {
        const buffer = Buffer.allocUnsafe(8);
        buffer[0] = t;
        buffer[1] = m;
        if (p == null)
            p = 0;
        buffer.writeInt32LE(p, 2);
        return buffer;
    }
}
module.exports = WsGateway;