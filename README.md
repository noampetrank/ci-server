Setup:
------
1. Make `./make.py -c -p' pass on the server.
2. Install node v8.11.3 or newer (wasn't tested on node 10.x).
3. Run 'npm install' from this folder.
4. Set the following environment variables in ~/.profile:
    BUGATONE_CI_GITHUB_APP_KEY - Path to the Github app private key.
    BUGATONE_CI_GITHUB_APP_INSTALLATION_ID - Get this value from request payloads in the app log in Github ('Advanced' page in the Github app settings page).
    BUGATONE_CI_GITHUB_APP_SECRET - Get this value from Github app settings.
    BUGATONE_AUTO_GMAIL_USERNAME - The Gmail account to send automatic email from.
    BUGATONE_AUTO_GMAIL_PASSWORD - Password of the above account.
    BUGATONE_NOTIFICATION_EMAILS - comma-separated list of emails to receive notifications when someone broke the master branch.
    BUGATONE_CI_ROOT - Path to the CI server root folder (e.g. /home/ubuntu/server/ci).
5. Execute this command to allow the normal user use port 80 (replace the path with the value returned when running: 'node -v'):
    sudo setcap CAP_NET_BIND_SERVICE=+eip /home/ubuntu/.nvm/versions/node/v8.11.3/bin/node
6. Add a CRON job for cleaning up old logs (assuming you server code is in /home/ubuntu/server/ci):
    0 4 * * 0 find /home/ubuntu/server/ci/public/* -type f -ctime +7 -exec rm -rf {} \;
7. Change server timezone to Asia/Jerusalem:
    sudo timedatectl set-timezone Asia/Jerusalem

Deployment:
-----------
1. Stop previous deployment:
    forever stopall
2. Verify no deployments are active:
    forever list
3. Pull latest code:
    git pull
4. Run this command from the 'ci' folder for installing necessary node modules:
    npm install
5. Deploy (assuming you server code is in /home/ubuntu/server/ci):
    forever start /home/ubuntu/server/ci/bin/www
6. Verify the deployment is active:
    forever list
7. Watch the log from 'forever list' output.
