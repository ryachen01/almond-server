// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2016 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

// Graphics API abstraction, based on nodejs-gm

const Q = require('q');
const gm = require('gm');

class Image {
    constructor(how) {
        this._gm = gm(how);
    }

    getSize() {
        return Q.ninvoke(this._gm, 'size');
    }

    resizeFit(width, height) {
        this._gm = this._gm.resize(width, height);
    }

    stream(format) {
        return Q.ninvoke(this._gm, 'stream', format);
    }

    toBuffer() {
        return Q.ninvoke(this._gm, 'toBuffer');
    }
}

module.exports = {
    createImageFromPath(path) {
        return new Image(path);
    },

    createImageFromBuffer(buffer) {
        return new Image(buffer);
    },
};

