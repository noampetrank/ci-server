'use strict';

const express = require('express');
const router = express.Router();
const dateFormat = require('dateformat');

const TestService = require('../services/tests');
const GithubService = require('../services/github');
const EmailService = require('../services/email');
const LogService = require("../services/log");
const SystemService = require("../services/system");

const GITHUB_REPO_OWNER = "bugatone";
const GITHUB_REPO_NAME = "mobileproduct";

const LOG_PATH = process.env.BUGATONE_CI_ROOT + "/public";
const LOG_FILE_NAME_PREFIX = "test_output";
const SERVER_ADRESS = "http://ci.bugatone.com";
const MAX_LOG_LENGTH_IN_GITHUB_COMMENTS = 10000;

router.use(async(req, res, next) => {
    LogService.log("\n\n************Request Body************");
    console.log(req.body);
    LogService.log("************************************\n\n");

    let validSignature = await GithubService.verifySignature(req.headers["x-hub-signature"], JSON.stringify(req.body));
    if (validSignature) {
        let repoName = req.body.repository.name;
        if (repoName != GITHUB_REPO_NAME) {
            LogService.warn("Unexpected repository: " + repoName);
            res.sendStatus(200);
            return;
        }
    
        next();
    }
    else {
        LogService.warn("Verification failed");
        res.status(401).send({ error: 'Invalid signature' })
    }
});

function getLogAddress(commitId) {
    return `${SERVER_ADRESS}/${LOG_FILE_NAME_PREFIX}_${commitId}`;
}

function saveLog(commitId, log) {
    let logPath = LOG_PATH + "/" + LOG_FILE_NAME_PREFIX + "_" + commitId;
    LogService.log("Saving log to file: " + logPath);
    return SystemService.writeFile(logPath, log);
}

function handleTestResult(pullRequestNum, commitId, testsPassed, testOutput, totalTestTime, totalQueueAndTestTime) {
    return new Promise(async (resolve, reject) => {
        let timingReport = "Testing took " + totalTestTime + "s. Total time: " + totalQueueAndTestTime + "s (including queue).";
        LogService.log("Timing of " + commitId + ": " + timingReport);

        try {
            let shortMessage;
            let status;
            if (testsPassed) {
                shortMessage = "Tests passed.\n";
                status = "success";
            }
            else {
                shortMessage = "Tests failed.\n";
                status = "failure";
            }
            shortMessage += timingReport;
            let fullMessage = shortMessage + "\nSee full log at: " + getLogAddress(commitId);

            if (!testsPassed && testOutput) {
                fullMessage += "\n```\n" + testOutput.slice(-MAX_LOG_LENGTH_IN_GITHUB_COMMENTS) + "\n```";
            }

            await GithubService.setCommitStatus(GITHUB_REPO_OWNER, GITHUB_REPO_NAME, commitId, status, shortMessage);

            await saveLog(commitId, testOutput);
            LogService.log("log saved successfully");

            if (pullRequestNum) {
                await GithubService.postPullRequestComment(GITHUB_REPO_OWNER, GITHUB_REPO_NAME, pullRequestNum, fullMessage);
            }
            else {
                await GithubService.postCommitComment(GITHUB_REPO_OWNER, GITHUB_REPO_NAME, commitId, fullMessage);
                if (!testsPassed) {
                    await EmailService.sendEmail(process.env.BUGATONE_NOTIFICATION_EMAILS, "Tests failed in master for commit " + commitId, fullMessage);
                }
            }

            resolve();
        } catch(err) {
            reject(err);
        }
    });
}

function notifyTestInProgress(commitId) {
    return new Promise(async (resolve, reject) => {
        try {
            await GithubService.setCommitStatus(GITHUB_REPO_OWNER, GITHUB_REPO_NAME, commitId, "pending", "Tests started at " + dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss") + " (Israel time)");
            resolve();
        } catch(err) {
            reject(err);
        }
    });
}

async function notifyTestError(commitId, errorMessage, testOutput) {
    try {
        if (testOutput) {
            await saveLog(commitId, testOutput);
        }
        await GithubService.setCommitStatus(GITHUB_REPO_OWNER, GITHUB_REPO_NAME, commitId, "error", "Tests error: " + errorMessage +
            (testOutput ? ("See full log at: " + getLogAddress(commitId) + "\n```\n" + testOutput.slice(-MAX_LOG_LENGTH_IN_GITHUB_COMMENTS) + "\n```") : ""));
    } catch(err) {
        LogService.error("Error notifying test error (commit " + commitId + ") to Github: " + err);
    }
}

router.post('/', async (req, res) => {
    let commitId;
    let pullRequestNum;
    let branch;
    let testQueued = false;

    try {
        // First we send a response. Then we handle the action.
        res.sendStatus(200);

        let action = req.body.action;
        if (!action) {
            if (req.body.ref == "refs/heads/master") {
                action = "push_to_master";
            }
            else {
                LogService.log("Ignoring request");
                return;
            }
        }

        LogService.log("action = " + action)
        switch(action) {
            case "opened":
            case "synchronize":
                commitId = req.body.pull_request.head.sha;
                branch = req.body.pull_request.head.ref;
                pullRequestNum = req.body.number;

                break;
            case "push_to_master":
                commitId = req.body.after;
                branch = "master";

                break;
            default:
                LogService.log("Unhandled action: " + action);
                return;
        }

        testQueued = true;
        await notifyTestInProgress(commitId);
        let queueStartTime = new Date();
        
        let { testsPassed, testOutput, totalTestTime } = await TestService.runTests(commitId, branch);
        
        let totalQueueAndTestTime = (new Date() - queueStartTime) / 1000;
        await handleTestResult(pullRequestNum, commitId, testsPassed, testOutput, totalTestTime, totalQueueAndTestTime);
    } catch(err) {
        LogService.error("Unexpected exception (commit " + commitId + "): " + JSON.stringify(err));
        if (testQueued) {
            notifyTestError(commitId, err.message, err.output);
        }
    }
});

module.exports = router;

