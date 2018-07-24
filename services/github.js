'use strict';

const octokit = require('@octokit/rest')();
const jsonwebtoken = require('jsonwebtoken');
const verifyGithubWebhook = require("verify-github-webhook").default;

const LogService = require("services/log");
const SystemService = require("services/system");

const BUGATONE_CI_GITHUB_APP_ID = 14241;
const BUGATONE_CI_GITHUB_APP_PEM = SystemService.readFileSync(process.env.BUGATONE_CI_GITHUB_APP_KEY);

const BUGATONE_CI_CONTEXT_STRING = "bugatone-ci";

function verifySignature(signature, payload) {
    return verifyGithubWebhook(signature, payload, process.env.BUGATONE_CI_GITHUB_APP_SECRET);
}

function generateJwtToken() {
    return jsonwebtoken.sign(
        {
            iat: Math.floor(new Date() / 1000),
            exp: Math.floor(new Date() / 1000) + 60,
            iss: BUGATONE_CI_GITHUB_APP_ID
        },
        BUGATONE_CI_GITHUB_APP_PEM,
        { algorithm: 'RS256' }
    );
}

function authenticateApp() {
    return new Promise(async (resolve, reject) => {
        try {
            octokit.authenticate({
                type: 'app',
                token: generateJwtToken(),
            });

            const { data: { token } } = await octokit.apps.createInstallationToken({
                installation_id: process.env.BUGATONE_CI_GITHUB_APP_INSTALLATION_ID
            });
            octokit.authenticate({ type: 'token', token });

            resolve();
        } catch(err) {
            reject("Error authenticating app: " + err);
        }
    });
}

function setCommitStatus(owner, repo, commitId, state, description) {
    return new Promise(async (resolve, reject) => {
        try {
            await authenticateApp();

            LogService.log("Creating commit status...");
            await octokit.repos.createStatus({
                owner: owner,
                repo: repo,
                sha: commitId,
                state: state,
                description: description,
                context: BUGATONE_CI_CONTEXT_STRING
            });
            LogService.log("Commit status created successfully");
 
            resolve();
        } catch(err) {
            reject("Error setting commit status: " + err);
        }
    });
}

function postPullRequestComment(owner, repo, pullRequestNum, commentText) {
    return new Promise(async (resolve, reject) => {
        try {
            await authenticateApp();

            LogService.log("Creating pull request comment...");
            await octokit.issues.createComment({
                owner: owner,
                repo: repo,
                number: pullRequestNum,
                body: commentText
            });
            LogService.log("Pull request comment created successfully");
 
            resolve();
        } catch(err) {
            reject("Error posting pull request comment: " + err);
        }
    });
}

function postCommitComment(owner, repo, commitId, commentText) {
    return new Promise(async (resolve, reject) => {
        try {
            await authenticateApp();

            LogService.log("Creating commit comment...");
            await octokit.repos.createCommitComment({
                owner: owner,
                repo: repo,
                sha: commitId,
                body: commentText
            });
            LogService.log("Commit comment created successfully");
 
            resolve();
        } catch(err) {
            reject("Error posting commit comment: " + err);
        }
    });
}

module.exports = {
    verifySignature: verifySignature,
    setCommitStatus: setCommitStatus,
    postPullRequestComment: postPullRequestComment,
    postCommitComment: postCommitComment
};