module.exports = {
  apps : [{
    name      : 'Bugatone CI',
    script    : 'bin/www',
    env: {
      NODE_PATH: '.'
    }
  }]
};
