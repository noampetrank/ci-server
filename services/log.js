'use strict';

function timeStr() {
    return new Date().toLocaleString();
}

function getFullLog(message) {
    return "[" + timeStr() + "] " + message;
}

function log(message) {
    console.log(getFullLog(message));
}

function error(message) {
    console.error(getFullLog(message));
}

function warn(message) {
    console.warn(getFullLog(message));
}

module.exports = {
    log: log,
    warn: warn,
    error: error
};
