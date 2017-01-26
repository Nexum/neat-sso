"use strict";

const Application = require("neat-base").Application;
const Module = require("neat-base").Module;
const Tools = require("neat-base").Tools;
const request = require('request');
const Promise = require("bluebird");


module.exports = class SSO extends Module {

    static defaultConfig() {
        return {
            webserverModuleName: "webserver",
            authModuleName: "auth",
            dbModuleName: "database"
        }
    }

    init() {
        return new Promise((resolve, reject) => {
            this.log.debug("Initializing...");
            this.dbModule = Application.modules[this.config.dbModuleName];
            this.authModule = Application.modules[this.config.authModuleName];
            this.webserverModule = Application.modules[this.config.webserverModuleName];

            if (this.webserverModule) {
                this.webserverModule.addRoute("post", "/sso/sync", (req, res) => {

                    if (!this.config.sync || !this.config.sync.length) {
                        req.status(500);
                        return res.end("No sync configured!");
                    }

                    if (!req.body.sync || !this.isValidSyncAuth(req.body.sync.auth)) {
                        req.status(401);
                        return res.end("Not authorized");
                    }

                    let userModel = this.dbModule.getModel("user");

                    userModel.find(req.body.query).then((docs) => {
                        let result = [];

                        for (let i = 0; i < docs.length; i++) {
                            let doc = docs[i];
                            let obj = {};

                            for (let j = 0; j < req.body.sync.paths.length; j++) {
                                let path = req.body.sync.paths[j];
                                obj[path] = doc.get(path);
                            }

                            result.push(obj);
                        }

                        res.json(result);
                    });
                });
            }

            return resolve(this);
        });
    }

    isValidSyncAuth(authKey) {
        if (!authKey || !this.config.sync) {
            return false;
        }

        for (let i = 0; i < this.config.sync.length; i++) {
            let syncConfig = this.config.sync[i];

            if (syncConfig.auth == authKey) {
                this.log.debug("Found valid sync key for " + syncConfig.name);
                return true;
            }
        }

        return false;
    }

    sendRequest(url, query) {
        return Promise.map(this.config.sync, (sync) => {
            return new Promise((resolve, reject) => {
                return request({
                    method: 'POST',
                    uri: sync.link + url,
                    body: {
                        query: query,
                        sync: sync
                    },
                    json: true
                }, (err, res, body) => {

                    if (err) {
                        return reject(err);
                    }

                    return resolve(body);
                });
            });
        });
    }

    syncUserByUsername(username) {
        this.log.debug("Syncing user with username " + username);
        let userModel = this.dbModule.getModel("user");
        let synced = false;
        return new Promise((resolve, reject) => {
            return this.sendRequest("/sso/sync", {
                username: username
            }).then((data) => {

                if (!data || !data.length) {
                    return;
                }

                return Promise.map(data, (syncedUsers) => {
                    return Promise.map(syncedUsers, (syncedFields) => {
                        return userModel.findOne({
                            username: syncedFields.username
                        }).then((doc) => {

                            if (!doc) {
                                doc = new userModel();
                            }

                            for (let key in syncedFields) {
                                doc.set(key, syncedFields[key]);
                            }

                            this.log.debug("Synced user " + syncedFields.username);
                            synced = true;
                            return doc.save({validateBeforeSave: false});
                        });
                    });
                });
            }, () => {
                resolve(synced);
            }).then(() => {
                resolve(synced);
            }, (err) => {
                this.log.debug(err.toString());
                resolve(synced);
            });
        });
    }

    syncUserByEmail(email) {
        this.log.debug("Syncing user with email " + email);
        let userModel = this.dbModule.getModel("user");
        let synced = false;
        return new Promise((resolve, reject) => {
            return this.sendRequest("/sso/sync", {
                email: email
            }).then((data) => {

                if (!data || !data.length) {
                    return;
                }

                return Promise.map(data, (syncedUsers) => {
                    return Promise.map(syncedUsers, (syncedFields) => {
                        return userModel.findOne({
                            email: syncedFields.email
                        }).then((doc) => {

                            if (!doc) {
                                doc = new userModel();
                            }

                            for (let key in syncedFields) {
                                doc.set(key, syncedFields[key]);
                            }

                            this.log.debug("Synced user " + syncedFields.email);
                            synced = true;
                            return doc.save({validateBeforeSave: false});
                        });
                    });
                });
            }, () => {
                resolve(synced);
            }).then(() => {
                resolve(synced);
            }, () => {
                resolve(synced);
            });
        });
    }
}