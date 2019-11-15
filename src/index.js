var HoststarClient = require('./hoststar')
var fs = require('fs');

(async () => {
  let defaultConfig = {
    username: 'username',
    password: 'password',
    debug: true,
    automaticOnly: true,
    destDir: './'
  }
  let userConfig = JSON.parse(fs.readFileSync(__dirname + '/../config/config.json', 'utf8'));
  let config = {...defaultConfig, ...userConfig }
  let hoststarClient = new HoststarClient(console, config)
  await hoststarClient.downloadBackups()
  return hoststarClient.destroy()
})();
