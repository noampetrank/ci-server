'use strict';

const { spawn } = require('child_process');
const fs = require("fs");
const mkdirp = require('mkdirp');
const path = require('path');

const LogService = require("services/log");

function exec(command, folder, timeout, libraryPath) {
    return new Promise((resolve, reject) => {
        let env = process.env;
        if (libraryPath) {
            env.LD_LIBRARY_PATH = libraryPath;
        }

        let opts = {
            cwd: folder,
            env: env,
            shell: true,
            detached: true
        };
        let cp = spawn(command, opts);

        let output = "";

        function handleNewOutput(data, isError) {
            let dataStr = data.toString();
            output += dataStr;

            if (data.slice(-1) == '\n') {
                dataStr = dataStr.slice(0, -1);
            }

            let lines = dataStr.split("\n");
            for (let line of lines) {
                if (isError) {
                    LogService.error(line);
                }
                else {
                    LogService.log(line);
                }
            }
        }

        cp.stdout.on("data", (data) => { handleNewOutput(data, false); });
        cp.stderr.on("data", (data) => { handleNewOutput(data, true); });

        let cpClosed = false;
        cp.on("close", (returnCode) => {
            cpClosed = true;
            resolve({
                returnCode: returnCode,
                output: output
            });
        });

        cp.on("error", (err) => {
            cpClosed = true;
            reject({
                message: err,
                output: output
            });
        });

        setTimeout(() => {
            if (!cpClosed) {
                output += "Error: child process timeout!!!";
                LogService.error("Error: child process timeout!!!");

                process.kill(-cp.pid);
                
                reject({
                    message: "'" + command + "' failed in " + folder + ": timeout",
                    output: output
                });
            }
        }, timeout);
    });
}

function readFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(data);
            }
        });
    });
}

function readFileSync(filePath) {
    return fs.readFileSync(filePath);
}

function makeDir(dirPath) {
    return new Promise((resolve, reject) => {
        mkdirp(dirPath, { mode: parseInt('0755', 8) }, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function writeFile(filePath, data) {
    return new Promise(async (resolve, reject) => {
        try {
            let dirPath = path.dirname(filePath);
            LogService.log("Creating directory: " + dirPath);
            await makeDir(dirPath);
            LogService.log("Directory created successfully: " + dirPath);
            LogService.log("Writing file: " + filePath);
            fs.writeFile(filePath, data, { flag: "w+" }, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    LogService.log("File written successfully: " + filePath);
                    resolve();
                }
            });
        } catch(err) {
            reject(err);
        }
    });
}

function listDir(path) {
    return new Promise(async (resolve, reject) => {
        fs.readdir(path, (err, files) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(files);
            }
        });
    });
}

module.exports = {
    exec: exec,
    readFile: readFile,
    readFileSync: readFileSync,
    writeFile: writeFile,
    listDir: listDir
};
