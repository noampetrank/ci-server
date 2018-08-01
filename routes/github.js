'use strict';

const express = require('express');
const router = express.Router();
const dateFormat = require('dateformat');

const TestService = require('services/tests');
const GithubService = require('services/github');
const EmailService = require('services/email');
const LogService = require('services/log');
const SystemService = require('services/system');
const ErrorService = require('services/error');

const GITHUB_REPO_OWNER = "bugatone";

const LOG_PATH = process.env.BUGATONE_CI_ROOT + "/public";
const LOG_FILE_NAME_PREFIX = "test_output";
const SERVER_ADRESS = "http://ci.bugatone.com";
const MAX_LOG_LENGTH_IN_GITHUB_COMMENTS = 10000;
const MAX_GITHUB_COMMIT_STATUS_LENGTH = 140;

router.use(async(req, res, next) => {
    try {
        LogService.log("\n\n************Request Body************");
        console.log(req.body);
        LogService.log("************************************\n\n");

        if (!("x-hub-signature" in req.headers)) {
            res.status(400).send({ error: 'Missing header: x-hub-signature' });
            return;
        }

        let validSignature = await GithubService.verifySignature(req.headers["x-hub-signature"], JSON.stringify(req.body));
        if (validSignature) {
            next();
        }
        else {
            LogService.warn("Verification failed");
            res.status(401).send({ error: 'Invalid signature' })
        }
    } catch(err) {
        LogService.error("Internal server error!!! " + err);
        res.status(500).send({ error: "Internal server error" });
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

function createResultMessage(testsPassed, totalTestTime, totalQueueAndTestTime, commitId, testOutput, isShortMessage) {
    let message;
    if (testsPassed) {
        message = "Tests passed.\n";
    }
    else {
        message = "Tests failed.\n";
    }
    message += getTimingReport(totalTestTime, totalQueueAndTestTime);
    if (isShortMessage) {
        return message;
    }

    message += "\nSee full log at: " + getLogAddress(commitId);

    if (!testsPassed && testOutput) {
        message += "\n```\n" + testOutput.slice(-MAX_LOG_LENGTH_IN_GITHUB_COMMENTS) + "\n```";
    }
    return message;
}

function getCommitState(testsPassed) {
    if (testsPassed) {
        return "success";
    }
    else {
        return "failure";
    }
}

function getTimingReport(totalTestTime, totalQueueAndTestTime) {
    return "Testing took " + totalTestTime + "s. Total time: " + totalQueueAndTestTime + "s (including queue).";
}

async function handleTestResult(repoName, pullRequestNum, commitId, testsPassed, testOutput, totalTestTime, totalQueueAndTestTime) {
    let isPullRequest = !!pullRequestNum;
    
    LogService.log("Timing of " + commitId + ": " + getTimingReport(totalTestTime, totalQueueAndTestTime));

    let shortMessage = createResultMessage(testsPassed, totalTestTime, totalQueueAndTestTime, commitId, testOutput, true);
    let fullMessage = createResultMessage(testsPassed, totalTestTime, totalQueueAndTestTime, commitId, testOutput, false);

    await GithubService.setCommitStatus(GITHUB_REPO_OWNER, repoName, commitId, getCommitState(testsPassed), shortMessage);

    await saveLog(commitId, testOutput);
    LogService.log("log saved successfully");

    if (isPullRequest) {
        await GithubService.postPullRequestComment(GITHUB_REPO_OWNER, repoName, pullRequestNum, fullMessage);
    }
    else {
        // This is a push to master.
        await GithubService.postCommitComment(GITHUB_REPO_OWNER, repoName, commitId, fullMessage);
        if (!testsPassed) {
            await EmailService.sendEmail(process.env.BUGATONE_NOTIFICATION_EMAILS, "Tests failed in master for commit " + commitId, fullMessage);
        }
    }
}

async function notifyTestInProgress(repoName, commitId) {
    await GithubService.setCommitStatus(GITHUB_REPO_OWNER, repoName, commitId, "pending", "Tests started at " + dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss") + " (Israel time)");
}

function getEventAction(requestBody) {
    let action = requestBody.action;
    if (!action) {
        if (requestBody.ref == "refs/heads/master") {
            action = "push_to_master";
        }
        else {
            return null;
        }
    }
    return action;
}

function getEventParams(requestBody) {
    let action = getEventAction(requestBody)

    switch(action) {
        case "opened":
        case "synchronize":
            LogService.log("Commit pushed into pull request #" + requestBody.number);
            return {
                commitId: requestBody.pull_request.head.sha,
                branch: requestBody.pull_request.head.ref,
                pullRequestNum: requestBody.number,
                repoName: requestBody.repository.name
            };
        case "push_to_master":
            LogService.log("Commit pushed into master");
            return {
                commitId: requestBody.after,
                branch: "master",
                repoName: requestBody.repository.name
            };
        default:
            if (action) {
                LogService.log("Unhandled action: " + action);
            }
            else {
                LogService.log("Unrecognized action");
            }
            return null;
    }
}

router.post('/', async (req, res) => {
    let testQueued = false;
    let eventParams;
    let queueStartTime;

    try {
        // First we send a response. Then we handle the event.
        res.sendStatus(200);

        eventParams = getEventParams(req.body);
        if (!eventParams) {
            LogService.log("Ignoring request");
            return;
        }

        await notifyTestInProgress(eventParams.repoName, eventParams.commitId);
        testQueued = true;
        queueStartTime = new Date();
        
        let { testsPassed, testOutput, totalTestTime } = await TestService.runTests(eventParams.repoName, eventParams.commitId, eventParams.branch);
        
        let totalQueueAndTestTime = (new Date() - queueStartTime) / 1000;
        await handleTestResult(eventParams.repoName, eventParams.pullRequestNum, eventParams.commitId, testsPassed, testOutput, totalTestTime, totalQueueAndTestTime);
    } catch(err) {
        err = ErrorService.getErrorWithOutput(err);
        LogService.error("Unexpected exception" + (eventParams ? " (commit " + eventParams.commitId + ")" : "") + ": " + err.message);
        if (testQueued) {
            let testTime = (new Date() - queueStartTime) / 1000;
            handleTestResult(eventParams.repoName, eventParams.pullRequestNum, eventParams.commitId, false, err.message + "\n" + err.output, testTime, testTime);
        }
    }
});

module.exports = router;

