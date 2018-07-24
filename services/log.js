'use strict';

function timeStr() {
    let date = new Date();
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().replace("T", " ").replace("Z", "");
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
