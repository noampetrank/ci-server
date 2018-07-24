'use strict';

const lockFile = require("lockfile");
const stripColor = require("strip-color");

const SystemService = require("services/system");
const GitService = require("services/git");
const LogService = require("services/log");

const LOCK_FILE = process.env.HOME + "/github.lock"
const LOCK_TIMEOUT = 1000 * 60 * 20 // 20 minutes

const MOBILEPRODUCT_FOLDER = process.env.HOME + "/mobileproduct";
const BUGATONE_SPACE_FOLDER = process.env.HOME + "/Bugatone-Space";
const TEST_FILES_FOLDER = process.env.HOME + "/test-files";
const GIT_LFS_TIMEOUT = 1000 * 60 * 20 // 20 minutes
const BUILD_TIMEOUT = 1000 * 60 * 10 // 10 minutes
const GTEST_PARALLEL_ERROR_LOG_PATH = MOBILEPRODUCT_FOLDER + "/gtest-parallel-logs/failed"

async function lock(commitId) {
    return new Promise(resolve => {
        LogService.log("Commit " + commitId + " is waiting for lock...");
        lockFile.lock(LOCK_FILE, { wait: LOCK_TIMEOUT }, function (err) {
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

async function runTests(commitId, branch) {
    try {
        let locked = await lock(commitId);
        if (!locked) {
            throw {
                message: "Unable to lock"
            };
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
        
        return {
            testsPassed: testResult.testsPassed,
            testOutput: testResult.output,
            totalTestTime: totalTestTime
        };
    } catch(err) {
        unlock(commitId);
        LogService.error("Running tests for branch '" + branch + "' failed: " + err.message);
        throw err;
    }
}

async function runTestsCycle(branch) {
    try {
        await prepareBugatoneSpace();
        await buildBugatoneSpace();

        await prepareTestFiles();

        await prepareMobileproduct(branch);
        let androidResult = await BuildAndroidMobileproduct();
        if (!androidResult.testsPassed) {
            LogService.error("Android build failed");
            return androidResult;
        }
        let result = await testMobileproduct();
        result.output = "Building Android:\n\n" + androidResult.output + "\n\nBuilding and Testing Linux:\n\n" + result.output;
        return result;
    } catch(err) {
        LogService.error("Running test cycle for branch '" + branch + "' failed: " + err.message);
        throw err;
    }
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

async function prepareRepo(folder, branch, pullTimeout) {
    try {
        await GitService.resetRepo(folder);
        await GitService.fetchRepo(folder);
        await GitService.checkoutRepo(folder, branch);
        await GitService.pullRepo(folder, branch, pullTimeout);
    } catch(err) {
        LogService.error("Preparing " + folder + " failed: " + err.message);
        throw err;
    }
}

async function buildBugatoneSpace() {
    try {
        LogService.log("Building Bugatone-Space...");
        let buildResult = await SystemService.exec("./make.sh linux", BUGATONE_SPACE_FOLDER, BUILD_TIMEOUT, BUGATONE_SPACE_FOLDER + "/lib/linux_x86");
        if (buildResult.returnCode != 0) {
            throw {
                message: "Error building " + folder + ": return value is " + buildResult.returnCode,
                output: buildResult.output
            };
        }
        LogService.log("Building Bugatone-Space successful");
    } catch(err) {
        LogService.error("Building Bugatone-Space failed: " + err.message);
        throw err;
    }
}

async function BuildAndroidMobileproduct() {
    LogService.log("Building mobileproduct for Android...");
    let result = await SystemService.exec("./make.py android", MOBILEPRODUCT_FOLDER, BUILD_TIMEOUT, BUGATONE_SPACE_FOLDER + "/lib/linux_x86");
    LogService.log("Building mobileproduct for Android done. Return code: " + result.returnCode);

    return {
        testsPassed: result.returnCode == 0,
        output: result.output
    };
}

async function testMobileproduct() {
    LogService.log("Building and testing mobileproduct...");
    let result = await SystemService.exec("./make.py -p -c", MOBILEPRODUCT_FOLDER, BUILD_TIMEOUT, BUGATONE_SPACE_FOLDER + "/lib/linux_x86");
    LogService.log("Building and testing mobileproduct done. Return code: " + result.returnCode);

    return {
        testsPassed: result.returnCode == 0,
        output: result.output
    };
}

async function getGtestParallelFailureLogs() {
    const ENOENT = -2;

    try {
        let errorLogFiles = await SystemService.listDir(GTEST_PARALLEL_ERROR_LOG_PATH);

        let readTasks = [];
        for (let errorLogFile of errorLogFiles) {
            readTasks.push(SystemService.readFile(GTEST_PARALLEL_ERROR_LOG_PATH + "/" + errorLogFile));
        } 
        LogService.log("Waiting for all failed logs to be read: " + errorLogFiles.join(", "));
        let logs = await Promise.all(readTasks);
        LogService.log("Failed logs read successfully");

        let errorLog = "\nFailed C++ tests:";
        for (let log of logs) {
            errorLog += "\n" + stripColor(log.toString());
        }
        console.log(errorLog);
        return errorLog;
    } catch(err) {
        if (err.errno == ENOENT) {
            LogService.log("No failed C++ tests found");
            return "";
        }
        else {
            LogService.error("Unable to read gtest-parallel logs: " + err);
            throw err;
        }
    }
}

module.exports = {
    runTests: runTests
};
