"use strict";

var Application = require("neat-base").Application;
var Module = require("neat-base").Module;
var Tools = require("neat-base").Tools;

module.exports = class SSO extends Module {

    static defaultConfig() {
        return {}
    }

    init() {
        return new Promise((resolve, reject) => {
            this.log.debug("Initializing...");
            return resolve(this);
        });
    }
}