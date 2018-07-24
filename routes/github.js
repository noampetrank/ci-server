var express = require('express');
var router = express.Router();
var verifyGithubWebhook = require("verify-github-webhook").default;

GITHUB_APP_SECRET = "6f1cc7d2c60e3c5a0cffb24ecb8c8594fc46ca23";

function verifySignature(signature, payload) {
  return verifyGithubWebhook(signature, payload, GITHUB_APP_SECRET);
}

router.use(async(req, res, next) => {
  console.log(req.body);
  console.log(req.headers["x-hub-signature"]);

  validSignature = await verifySignature(req.headers["x-hub-signature"], JSON.stringify(req.body));
  if (validSignature) {
    next();
  }
  else {
    res.status(401).send({ error: 'Invalid signature' })
  }
})

router.post('/', async (req, res) => {
  console.log("success");
  res.sendStatus(200);
});

module.exports = router;

