'use strict';

const SystemService = require("services/system");
const LogService = require("services/log");
const ErrorService = require('services/error');

const GIT_TIMEOUT = 1000 * 20 // 20 seconds

async function executeGitCommand(argsStr, folder, timeout) {
    LogService.log("Executing 'git " + argsStr +"' in folder " + folder + " with timeout = " + timeout + "ms...");
    let result = await SystemService.exec("git " + argsStr, folder, timeout);
    if (result.returnCode != 0) {
        throw new ErrorService.ErrorWithOutput(
            "Error executing 'git " + argsStr +"' in folder " + folder + ": return value is " + result.returnCode,
            result.output
        );
    }

    LogService.log("Succesfully executed 'git " + argsStr + "'");
}

async function pullRepo(folder, branch, pullTimeout) {
    pullTimeout = pullTimeout || GIT_TIMEOUT;
    try {
        await executeGitCommand("pull", folder, pullTimeout);
    } catch(pullError) {
        pullError = ErrorService.getErrorWithOutput(pullError);
        LogService.log("Pulling " + folder + " failed: " + pullError.message + ". Trying to reset to origin");
        try {
            await resetRepoToOrigin(folder, branch);
        } catch(resetError) {
            resetError = ErrorService.getErrorWithOutput(resetError);
            throw new ErrorService.ErrorWithOutput(
                pullError.message + ". " + resetError.message,
                pullError.output + "\n" + resetError.output
            );
        }
    }
}

function fetchRepo(folder) {
    return executeGitCommand("fetch origin", folder, GIT_TIMEOUT);
}

async function resetRepo(folder) {
    await executeGitCommand("reset --hard", folder, GIT_TIMEOUT);
    await executeGitCommand("clean -f", folder, GIT_TIMEOUT);
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
