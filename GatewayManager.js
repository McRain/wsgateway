"use strict";
const WsGateway = require("./WsGateway.js");
class GatewayManager {
    constructor() {
        this._gateway = null;
    }
    static get Handlers() {
        return this._handlers;
    }
    static RegHandler(code, target) {
        target.Code = code;
        GatewayManager.Handlers[code] = target.RequestHandler;
    }
    static Start(port, origin, userAuth, onConnectHook) {
        this._gateway = new WsGateway({ "origin": origin, "port": port, "hashKey": "hash=" }, GatewayManager.BasicAuth, userAuth);
        this._gateway.on(WsGateway.START, function (w) {

        });
        this._gateway.on(WsGateway.ERROR, function (e) {

        });
        this._gateway.on(WsGateway.CLOSE, function (c, m, user) {

        });
        this._gateway.on(WsGateway.CONNECT, onConnectHook);
        this._gateway.on(WsGateway.MESSAGE, GatewayManager.CallHandler);
        this._gateway.start();
    }
    static BasicAuth(info, done) {
        return done(true);
    }
    static CallHandler(user, target, method, packet, data) {

    }
}
module.exports = GatewayManager;