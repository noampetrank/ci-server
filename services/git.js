'use strict';

const SystemService = require("./system");
const LogService = require("./log");

const GIT_TIMEOUT = 1000 * 20 // 20 seconds

function executeGitCommand(argsStr, folder, timeout) {
    return new Promise(async (resolve, reject) => {
        try {
            LogService.log("Executing 'git " + argsStr +"' in folder " + folder + " with timeout = " + timeout + "ms...");
            let result = await SystemService.exec("git " + argsStr, folder, timeout);
            if (result.returnCode != 0) {
                throw {
                    message: "Error executing 'git " + argsStr +"' in folder " + folder + ": return value is " + result.returnCode,
                    output: result.output
                };
            }
            else {
                LogService.log("Succesfully executed 'git " + argsStr + "'");
                resolve();
            }
        } catch(err) {
            reject(err);
        }
    });
}

function pullRepo(folder, branch, pullTimeout) {
    return new Promise(async (resolve, reject) => {
        pullTimeout = pullTimeout || GIT_TIMEOUT;
        try {
            await executeGitCommand("pull", folder, pullTimeout);
            resolve();
        } catch(pullError) {
            LogService.log("Pulling " + folder + " failed: " + pullError.message + ". Trying to reset to origin");
            try {
                await resetRepoToOrigin(folder, branch);
                resolve();
            } catch(resetError) {
                reject({
                    message: pullError.message + ". " + resetError.message,
                    output: pullError.output + "\n" + resetError.output
                });
            }
        }
    });
}

function fetchRepo(folder) {
    return executeGitCommand("fetch origin", folder, GIT_TIMEOUT);
}

function resetRepo(folder) {
    return new Promise(async (resolve, reject) => {
        try {
            await executeGitCommand("reset --hard", folder, GIT_TIMEOUT);
        } catch(err) {
            reject(err);
            return;
        }

        try {
            await executeGitCommand("clean -f", folder, GIT_TIMEOUT);
            resolve();
        } catch(err) {
            reject(err);
        }
    });
}

function resetRepoToOrigin(folder, branch) {
    return executeGitCommand("reset --hard origin/" + branch, folder, GIT_TIMEOUT);
}

function checkoutRepo(folder, branch) {
    return executeGitCommand("checkout " + branch, folder, GIT_TIMEOUT);
}

module.exports = {
    pullRepo: pullRepo,
    fetchRepo: fetchRepo,
    resetRepo: resetRepo,
    checkoutRepo: checkoutRepo
};
