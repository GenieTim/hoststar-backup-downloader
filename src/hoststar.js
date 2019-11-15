const puppeteer = require('puppeteer')
const fs = require('fs')
const https = require('https')

class HoststarClient {
  constructor(logger, config) {
    this.loggedIn = false
    this.logger = logger
    // read shortcut config properties
    this.config = config
    this.debug = config.debug
    // set default urls to be used/visited
    this.baseUrl = 'https://my.hoststar.ch'
    this.loginUrl = this.baseUrl + '/login'
    this.backupUrl = this.baseUrl + '/hosting/backup-lx'
  }

  /**
   * Initialize the browser/driver
   */
  async initialize() {
    const browser = await puppeteer.launch({
      headless: !this.debug,
      userDataDir: './user_data',
    })
    try {
      this.driver = await browser.newPage()
    } catch (error) {
      this.logger.error(error)
      return
    }
    if (this.debug) {
      this.driver.setViewport({ width: 0, height: 0 })
    }
    await this.driver.goto(this.baseUrl)
  }

  /**
   * Login to Hoststar
   */
  async login() {
    if (!this.driver) {
      await this.initialize()
    }
    await this.driver.goto(this.loginUrl);

    // check if login is necessary at all
    if (this.driver.url().startsWith(this.loginUrl)) {
      await this.randomSleep(1000)
      await this.driver.type('input[name=username]', this.config.username)
      await this.randomSleep(1000)
      await this.driver.type('input[name=password]', this.config.password)
      await this.randomSleep(1000)
      await this.driver.$eval('form', form => form.submit())
      await this.randomSleep()

      if (this.driver.url().startsWith(this.loginUrl)) {
        this.logger.error('Login failed.')
      }
    }
    // logged in
    this.loggedIn = true
  }

  /**
   * Download all backups 
   */
  async downloadBackups() {
    if (!this.loggedIn) {
      await this.login()
    }

    await this.driver.goto(this.backupUrl)
    await this.randomSleep(1000)
    let runSelector = '#frame .content .hsBox.withBlockLayout'
    let backupRuns = await this.driver.$$(runSelector)
    let promises = [];
    for await (const [runIdx, backupRun] of backupRuns.entries()) {
      this.log('Handling backuprun ' + (runIdx + 1) + '/' + backupRuns.length)
      let runClickSelector = '.withSwingAction .gather'
      try {
        let clickArea = await backupRun.$(runClickSelector)
        await clickArea.click()
      } catch (e) {
        // alternative click
        await this.driver.evaluate((runIdx, runSelector, runClickSelector) => {
          return Promise.resolve(document.querySelectorAll(runSelector + ' ' + runClickSelector)[runIdx].click())
        }, runIdx, runSelector, runClickSelector)
      }
      await this.randomSleep(5000)
      let backups = await backupRun.$$('.bodyContent tr a')
      // only download automatic backups?
      // rather brave comparison: casting bool to int,
      // assuming all automatic backups are kept > 1
      // => optionated :/
      if (backups.length > this.config.automaticOnly) {
        for await (const [aIdx, backupA] of backups.entries()) {
          this.log('\tHandling backup ' + (aIdx + 1) + '/' + backups.length)
          let url = await (await backupA.getProperty('href')).jsonValue()
          if (!url) {
            this.logger.warn("URL not found")
            this.log(backupA.getProperties())
          }
          // fortunately, hoststar does not check the login upon opening such a URL,
          // so we can download through node instead of through pupeteer/Chrome
          promises.push(this.downloadFile(url))
          this.randomSleep(1000)
        }
      }
    }

    await Promise.all(promises)
    this.log('Done downloading backups.')
  }

  /**
   * Download a file according to the config
   * 
   * @param {string} url the file location to download from
   */
  downloadFile(url) {
    let self = this
    return new Promise(resolve => {
      let filename = url.split('/').pop().split('#')[0].split('?')[0]
      let destFile = self.config.destDir + "/" + filename
      if (fs.existsSync(destFile)) {
        self.log('File "' + destFile + '" already exists. Skipping.')
        resolve()
      }
      const file = fs.createWriteStream(destFile)
      self.log('Writing from "' + url + '" to ' + destFile)
      const request = https.get(url, function (response) {
        response.pipe(file);
        file.on('finish', function () {
          file.close(resolve);
        });
      }).on('error', function (err) { // Handle errors
        fs.unlink(file) // Delete the file async. (But we don't check the result)
        self.logger.error(err)
        resolve()
      });
    })
  }

  /**
   * Sleep for a random amount of time
   *
   * @param {double} maximum The maximum sleep time in milliseconds
   */
  async randomSleep(maximum = 10000) {
    await this.sleep(maximum * Math.random())
  }

  /**
   * Sleep for a certain time, but only if you have time to `await` it
   *
   * @param {double} millis Millisecond time to sleep
   * @returns {Promise} to sleep. Just like we did. In the end still read a book under the bed sheets.
   */
  sleep(millis) {
    return new Promise(resolve => setTimeout(resolve, millis))
  }

  /**
   * Write log if debug is enabled
   * 
   * @param {string} text 
   */
  log(text) {
    if (this.debug) {
      this.logger.log(text)
    }
  }

  /**
   * Reset this instance
   */
  destroy() {
    return this.driver.close()
  }
}

module.exports = HoststarClient
