'use strict';

const { spawn } = require('child_process');
const bluebird = require("bluebird");
const fs = bluebird.promisifyAll(require("fs"));

const LogService = require("services/log");
const ErrorService = require('services/error');

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
            reject(getErrorWithOutput(err, output));
        });

        setTimeout(() => {
            if (!cpClosed) {
                output += "Error: child process timeout!!!";
                LogService.error("Error: child process timeout!!!");

                process.kill(-cp.pid);
                
                reject(new ErrorService.ErrorWithOutput("'" + command + "' failed in " + folder + ": timeout", output));
            }
        }, timeout);
    });
}

async function readFile(filePath) {
    return fs.readFileAsync(filePath);
}

function readFileSync(filePath) {
    return fs.readFileSync(filePath);
}

async function writeFile(filePath, data) {
    LogService.log("Writing file: " + filePath);
    await fs.writeFileAsync(filePath, data, { flag: "w+" });
    LogService.log("File written successfully: " + filePath);
}

async function listDir(path) {
    return fs.readdirAsync(path);
}

module.exports = {
    exec: exec,
    readFile: readFile,
    readFileSync: readFileSync,
    writeFile: writeFile,
    listDir: listDir
};
