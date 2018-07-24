'use strict';

const lockFile = require('lockfile')
const SystemService = require("./system");
const GitService = require("./git");
const LogService = require("./log");

const LOCK_FILE = process.env.HOME + "/github.lock"
const LOCK_TIMEOUT = 1000 * 60 * 20 // 20 minutes

const MOBILEPRODUCT_FOLDER = process.env.HOME + "/mobileproduct";
const BUGATONE_SPACE_FOLDER = process.env.HOME + "/Bugatone-Space";
const TEST_FILES_FOLDER = process.env.HOME + "/test-files";
const GIT_LFS_TIMEOUT = 1000 * 60 * 20 // 20 minutes
const BUILD_TIMEOUT = 1000 * 60 * 10 // 10 minutes
const GTEST_PARALLEL_ERROR_LOG_PATH = MOBILEPRODUCT_FOLDER + "/gtest-parallel-logs/failed"

function lock(commitId) {
    return new Promise(resolve => {
        LogService.log("Commit " + commitId + " is waiting for lock...");
        lockFile.lock(LOCK_FILE, { stale: LOCK_TIMEOUT }, function (err) {
            if (err) {
                LogService.error("Error: Unable to acquire lock: " + err);
                resolve(false);
            }
            else {
                LogService.log("Lock acquired for commit " + commitId);
                resolve(true);
            }
        });
    });
}

function unlock(commitId) {
    lockFile.unlock(LOCK_FILE, function (err) {
        if (err) {
            LogService.error("Error: Unable to release lock");
        }
        else {
            LogService.log("Lock released for commit " + commitId);
        }
    });
}

function runTests(commitId, branch) {
    return new Promise(async (resolve, reject) => {
        try {
            let locked = await lock(commitId);
            if (!locked) {
                reject({
                    message: "Unable to lock"
                });
                return;
            }

            let testStartTime = new Date();
            let testResult = await runTestsCycle(branch);
            let totalTestTime = (new Date() - testStartTime) / 1000;

            if (!testResult.testsPassed) {
                try {
                    testResult.output += await getGtestParallelFailureLogs();
                } catch(err) {
                    LogService.warn("Unable to read gtest-parallel logs");
                }
            }

            unlock(commitId);
            
            resolve({
                testsPassed: testResult.testsPassed,
                testOutput: testResult.output,
                totalTestTime: totalTestTime
            });
        } catch(err) {
            unlock(commitId);
            LogService.error("Running tests for branch '" + branch + "' failed: " + err.message);
            reject(err);
        }
    });
}

function runTestsCycle(branch) {
    return new Promise(async (resolve, reject) => {
        try {
            await prepareBugatoneSpace();
            await buildBugatoneSpace();

            await prepareTestFiles();

            await prepareMobileproduct(branch);
            resolve(await testMobileproduct(branch));
        } catch(err) {
            LogService.error("Running test cycle for branch '" + branch + "' failed: " + err.message);
            reject(err);
        }
    });
}

function getGtestParallelFailureLogs() {
    const ENOENT = -2;

    return new Promise(async (resolve, reject) => {
        try {
            let errorLogFiles = await SystemService.listDir(GTEST_PARALLEL_ERROR_LOG_PATH);

            let readTasks = [];
            for (let errorLogFile of errorLogFiles) {
                readTasks.push(SystemService.readFile(GTEST_PARALLEL_ERROR_LOG_PATH + "/" + errorLogFile));
            } 
            LogService.log("Waiting for all failed logs to be read: " + errorLogFiles.join(", "));
            let logs = await Promise.all(readTasks);
            LogService.log("Failed logs read successfully");

            let errorLog = "";
            for (let log of logs) {
                errorLog += "\n" + log;
            }
            resolve(errorLog);

        } catch(err) {
            if (err.errno == ENOENT) {
                LogService.log("No failed C++ tests found");
                resolve("");
            }
            else {
                LogService.error("Unable to read gtest-parallel logs: " + err);
                reject(err);
            }
        }
    });
}

async function prepareBugatoneSpace() {
    return await prepareRepo(BUGATONE_SPACE_FOLDER, "master");
}

async function prepareTestFiles() {
    return await prepareRepo(TEST_FILES_FOLDER, "master", GIT_LFS_TIMEOUT);
}

async function prepareMobileproduct(branch) {
    return await prepareRepo(MOBILEPRODUCT_FOLDER, branch);
}

function prepareRepo(folder, branch, pullTimeout) {
    return new Promise(async (resolve, reject) => {
        try {
            await GitService.resetRepo(folder);
            await GitService.fetchRepo(folder);
            await GitService.checkoutRepo(folder, branch);
            await GitService.pullRepo(folder, pullTimeout);
            resolve();
        } catch(err) {
            LogService.error("Preparing " + folder + " failed: " + err.message);
            reject(err);
        }
    });
}

function buildBugatoneSpace() {
    return new Promise(async (resolve, reject) => {
        try {
            LogService.log("Building Bugatone-Space...");
            let buildResult = await SystemService.exec("./make.sh linux", BUGATONE_SPACE_FOLDER, BUILD_TIMEOUT, BUGATONE_SPACE_FOLDER + "/lib/linux_x86");
            if (buildResult.returnCode != 0) {
                throw {
                    message: "Error building " + folder + ": return value is " + buildResult.returnCode,
                    output: buildResult.output
                };
            }
            else {
                LogService.log("Building Bugatone-Space successful");
                resolve();
            }
        } catch(err) {
            LogService.error("Building Bugatone-Space failed: " + err.message);
            reject(err);
        }
    });
}

function testMobileproduct(branch) {
    return new Promise(async (resolve, reject) => {
        try {
            LogService.log("Building and testing mobileproduct...");
            let result = await SystemService.exec("./make.py -p -c", MOBILEPRODUCT_FOLDER, BUILD_TIMEOUT, BUGATONE_SPACE_FOLDER + "/lib/linux_x86");
            LogService.log("Building and testing mobileproduct done. Return code: " + result.returnCode);
            resolve({
                testsPassed: result.returnCode == 0,
                output: result.output
            });
        } catch(err) {
            LogService.warn("Error building and testing mobileproduct: " + err.message);
            resolve({
                testsPassed: false,
                output: err.output,
                message: err.message
            });
        }
    });
}

module.exports = {
    runTests: runTests
};
