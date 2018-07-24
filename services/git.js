'use strict';

const SystemService = require("./system");
const LogService = require("./log");

const GIT_TIMEOUT = 1000 * 20 // 20 seconds

function pullRepo(folder, branch, pullTimeout) {
    return new Promise(async (resolve, reject) => {
        pullTimeout = pullTimeout || GIT_TIMEOUT;

        try {
            LogService.log("Pulling " + folder + " with timeout = " + pullTimeout + "ms...");
            let pullResult = await SystemService.exec("git pull", folder, pullTimeout);
            if (pullResult.returnCode != 0) {
                throw {
                    message: "Error pulling " + folder + ": return value is " + pullResult.returnCode,
                    output: pullResult.output
                };
            }
            else {
                LogService.log("Succesfully pulled " + folder);
                resolve();
            }
        } catch(err) {
            LogService.log("Pulling " + folder + " failed: " + err.message + ". Trying to reset to origin");
            try {
                await resetRepoToOrigin(folder, branch);
                resolve();
            } catch (err) {
                reject(err);
            }
        }
    });
}

function fetchRepo(folder) {
    return new Promise(async (resolve, reject) => {
        try {
            LogService.log("Fetching " + folder + " with timeout = " + GIT_TIMEOUT + "ms...");
            let fetchResult = await SystemService.exec("git fetch origin", folder, GIT_TIMEOUT);
            if (fetchResult.returnCode != 0) {
                throw {
                    message: "Error fetching " + folder + ": return value is " + fetchResult.returnCode,
                    output: fetchResult.output
                };
            }
            else {
                LogService.log("Succesfully fetched " + folder);
                resolve();
            }
        } catch(err) {
            LogService.error("Fetching " + folder + " failed: " + err.message);
            reject(err);
        }
    });
}

function resetRepo(folder) {
    return new Promise(async (resolve, reject) => {
        try {
            LogService.log("Resetting " + folder + "...");
            let resetResult = await SystemService.exec("git reset --hard", folder, GIT_TIMEOUT);
            if (resetResult.returnCode != 0) {
                throw {
                    message: "Error resetting " + folder + ": return value is " + resetResult.returnCode,
                    output: resetResult.output
                };
            }
            else {
                LogService.log("Succesfully reset " + folder);
            }
        } catch(err) {
            LogService.error("Resetting " + folder + " failed: " + err.message);
            reject(err);
            return;
        }

        try {
            LogService.log("Cleaning " + folder + "...");
            let cleanResult = await SystemService.exec("git clean -f", folder, GIT_TIMEOUT);
            if (cleanResult.returnCode != 0) {
                throw {
                    message: "Error cleaning " + folder + ": return value is " + cleanResult.returnCode,
                    output: cleanResult.output
                };
            }
            else {
                LogService.log("Succesfully cleaned " + folder);
                resolve();
            }
        } catch(err) {
            LogService.error("Cleaning " + folder + " failed: " + err.message);
            reject(err);
        }
    });
}

function resetRepoToOrigin(folder, branch) {
    return new Promise(async (resolve, reject) => {
        try {
            LogService.log("Resetting " + folder + " to origin/" + branch + "...");
            let resetResult = await SystemService.exec("git reset --hard origin/" + branch, folder, GIT_TIMEOUT);
            if (resetResult.returnCode != 0) {
                throw {
                    message: "Error resetting " + folder + " to origin: return value is " + resetResult.returnCode,
                    output: resetResult.output
                };
            }
            else {
                LogService.log("Succesfully reset to origin " + folder);
                resolve();
            }
        } catch(err) {
            LogService.error("Resetting " + folder + " to origin failed: " + err.message);
            reject(err);
        }
    });
}

function checkoutRepo(folder, branch) {
    return new Promise(async (resolve, reject) => {
        try {
            LogService.log("Checking out " + folder + "...");
            let checkoutResult = await SystemService.exec("git checkout " + branch, folder, GIT_TIMEOUT);
            if (checkoutResult.returnCode != 0) {
                throw {
                    message: "Error checking out " + folder + ": return value is " + checkoutResult.returnCode,
                    output: checkoutResult.output
                };
            }
            else {
                LogService.log("Succesfully checkout " + branch + " in " + folder);
                resolve();
            }
        } catch(err) {
            LogService.error("Checking out " + folder + " failed: " + err.message);
            reject(err);
        }
    });
}

module.exports = {
    pullRepo: pullRepo,
    fetchRepo: fetchRepo,
    resetRepo: resetRepo,
    checkoutRepo: checkoutRepo
};
