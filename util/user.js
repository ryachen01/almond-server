// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2015 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const crypto = require('crypto');
const util = require('util');
const BaseStrategy = require('passport-strategy');

const platform = require('../service/platform');
const Config = require('../config');

// a model of user based on sharedpreferences
const model = {
    isConfigured() {
        var prefs = platform.getSharedPreferences();
        var user = prefs.get('server-login');
        return user !== undefined;
    },

    get() {
        var prefs = platform.getSharedPreferences();
        var user = prefs.get('server-login');
        if (user === undefined)
            throw new Error("Login not configured yet");
        return user;
    },

    set(salt, sqliteKeySalt, passwordHash) {
        var prefs = platform.getSharedPreferences();
        var user = { password: passwordHash,
                     salt: salt,
                     sqliteKeySalt: sqliteKeySalt };
        prefs.set('server-login', user);
        return user;
    }
};

class HostBasedStrategy extends BaseStrategy {
    constructor() {
        super();
        this.name = 'host-based';

        this._mode = Config.HOST_BASED_AUTHENTICATION;
        if (['disabled', 'local-ip', 'proxied-ip', 'insecure'].indexOf(this._mode) < 0)
            throw new Error(`Configuration error: invalid value ${this._mode} for HOST_BASED_AUTHENTICATION setting`);
    }

    authenticate(req, options) {
        // if the server is not configured, disable HBA and let the user set the password
        if (!model.isConfigured())
            return this.pass();
        // if the engine is still locked (DB encryption is on), we need the user to enter their password
        if (req.isLocked)
            return this.pass();

        // otherwise, we allow if mode is insecure (all IPs are OK), or if the IP is local
        // whether the IP is the proxy/direct client, or the proxied client depends on the "trust proxy" setting
        if (this._mode === 'insecure' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1' || req.ip === '::1')
            return this.success(model.get());
        else
            return this.pass();
    }
}

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

function makeRandom() {
    return crypto.randomBytes(32).toString('hex');
}

function hashPassword(salt, password) {
    return util.promisify(crypto.pbkdf2)(password, salt, 10000, 32, 'sha1')
        .then((buffer) => buffer.toString('hex'));
}

function initializePassport() {
    passport.serializeUser((user, done) => {
        done(null, user);
    });

    passport.deserializeUser((user, done) => {
        done(null, user);
    });

    passport.use(new HostBasedStrategy());

    passport.use(new LocalStrategy((username, password, done) => {
        Promise.resolve().then(() => {
            try {
                var user = model.get();

                return hashPassword(user.salt, password).then((hash) => {
                    if (hash !== user.password)
                        return [false, "Invalid username or password"];

                    return ['local', null];
                });
            } catch(e) {
                return [false, e.message];
            }
        }).then((result) => {
            done(null, result[0], { message: result[1] });
        }, (err) => {
            done(err);
        });
    }));
}

module.exports = {
    initializePassport: initializePassport,

    isConfigured() {
        return model.isConfigured();
    },

    register(password) {
        var salt = makeRandom();
        var sqliteKeySalt = makeRandom();
        return hashPassword(salt, password).then((hash) => {
            return model.set(salt, sqliteKeySalt, hash);
        });
    },

    unlock(req, password) {
        var user = model.get();
        hashPassword(user.sqliteKeySalt, password).then((key) => {
            req.app.frontend.unlock(key);
        });
    },

    /* Middleware to check if the user is logged in before performing an
     * action. If not, the user will be redirected to an error page.
     *
     * To be used for POST actions, where redirectLogin would not work.
     */
    requireLogIn(req, res, next) {
        if (!model.isConfigured()) {
            res.status(401).render('configuration_required',
                                   { page_title: "Almond - Error" });
        } else if (!req.user) {
            res.status(401).render('login_required',
                                   { page_title: "Almond - Error" });
        } else {
            next();
        }
    },

    /* Middleware to insert user log in page
     * After logging in, the user will be redirected to the original page
     */
    redirectLogIn(req, res, next) {
        if (!model.isConfigured()) {
            req.session.redirect_to = req.originalUrl;
            res.redirect(Config.BASE_URL + '/user/configure');
        } else if (!req.user) {
            req.session.redirect_to = req.originalUrl;
            res.redirect(Config.BASE_URL + '/user/login');
        } else {
            next();
        }
    }
};
