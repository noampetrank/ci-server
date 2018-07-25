'use strict';

const express = require('express');
const router = express.Router();

// Dummy route - only used for verifying that the app is alive.
router.get('/', (req, res) => {
    res.sendStatus(200);
});

module.exports = router;

