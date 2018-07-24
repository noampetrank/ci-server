#!/usr/bin/env bash

error() {
    echo -e "\e[91m$1\e[0m"
}

exit_script() {
    cd $orig_pwd
    return $1
}

check_installation() {
    $2 &> /dev/null
    if [ $? -eq 0 ]
    then
        echo "$1 installed"
        return 1
    else
        echo "$1 not installed"
        return 0
    fi
}

require_env_var() {
    grep "export $1" ~/.profile  &> /dev/null
    if [ $? -eq 1 ]
    then
        error "Please export environment variable in ~/.profile: $1"
    fi
}

if [[ $_ == $0 ]]
then
    error "Please execute the script using 'source'"
    exit 1
fi

orig_pwd=$(pwd)

check_installation "NVM" "nvm --version"
if [ $? -eq 0 ]
then
    echo "Installing NVM..."
    curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash
    check_installation "NVM" "nvm --version"
    if [ $? -eq 0 ]
    then
        error "Error installing NVM. Exiting"
        exit_script 1
    fi
fi

echo "Installing latest Node JS LTS version..."
nvm install --lts
nvm use --lts
check_installation "Node JS" "which node"
if [ $? -eq 0 ]
then
    error "Error installing node. Exiting"
    exit_script 1
fi

echo "Allowing node to use port 80 without sudo..."
node_bin=$(which node)
sudo setcap CAP_NET_BIND_SERVICE=+eip $node_bin
if [ $? -ne 0 ]
then
    error "Error allowing node to use port 80. Exiting"
    exit_script 1
fi
echo "Using port 80 allowed"

echo "Setting timezone to Asia/Jerusalem..."
sudo timedatectl set-timezone Asia/Jerusalem
if [ $? -ne 0 ]
then
    error "Error setting timezone. Exiting"
    exit_script 1
fi
echo "Timezone set"

check_installation "forever" "which forever"
if [ $? -eq 0 ]
then
    echo "Installing forever..."
    sudo npm install forever -g
    check_installation "forever" "which forever"
    if [ $? -ne 0 ]
    then
        error "Error installing forever. Exiting"
        exit_script 1
    fi
fi

cd
if [ ! -d ci-server ]
then
    echo "checkout ci-server"
    git clone https://github.com/Bugatone/ci-server.git
    if [ $? -ne 0 ]
    then
        error "Error cloning ci-server. Exiting"
        exit_script 1
    fi
    sudo chown -R ubuntu:ubuntu ci-server
    echo "ci-server checked out"
fi

grep "export BUGATONE_CI_ROOT" ~/.profile  &> /dev/null
if [ $? -eq 1 ]
then
    echo "Updating .profile file..."
    echo "export BUGATONE_CI_ROOT=/home/ubuntu/ci-server" >> ~/.profile
    source ~/.profile
fi

crontab -l > mycron
grep "0 4 \* \* 0 find \/home\/ubuntu\/ci-server\/public\/\* -type f -ctime +7 -exec rm -rf {} \\\;" mycron  &> /dev/null
if [ $? -eq 1 ]
then
    echo "Installing a CRON job to clean up logs..."
    echo "0 4 * * 0 find /home/ubuntu/ci-server/public/* -type f -ctime +7 -exec rm -rf {} \;" >> mycron
    crontab mycron
    if [ $? -ne 0 ]
    then
        rm mycron
        error "Error installing CRON job. Exiting"
        exit_script 1
    fi
    echo "CRON job installed"
fi
rm mycron

echo "Installing required npm modules for ci-server..."
cd ci-server
npm install --no-audit
if [ $? -ne 0 ]
then
    error "Error installing required npm mpdules. Exiting"
    exit_script 1
fi
echo "npm modules installed"

require_env_var "BUGATONE_CI_GITHUB_APP_KEY"
require_env_var "BUGATONE_CI_GITHUB_APP_INSTALLATION_ID"
require_env_var "BUGATONE_CI_GITHUB_APP_SECRET"
require_env_var "BUGATONE_AUTO_GMAIL_USERNAME"
require_env_var "BUGATONE_AUTO_GMAIL_PASSWORD"
require_env_var "BUGATONE_NOTIFICATION_EMAILS"

exit_script 0