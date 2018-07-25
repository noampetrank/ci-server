'use strict';

class ErrorWithOutput extends Error {
    constructor(message, output) {
        super(message);
        this.output = output;
    }
}

function getErrorWithOutput(err, output) {
    output = output || "";

    if (err instanceof ErrorWithOutput) {
        return err;
    }
    if (err instanceof Error) {
        return new ErrorWithOutput(err.message, output);
    }

    return new ErrorWithOutput(err.toString(), output);
}

module.exports = {
    ErrorWithOutput: ErrorWithOutput,
    getErrorWithOutput: getErrorWithOutput
};
