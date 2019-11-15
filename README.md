# hoststar-backup-downloader
Download Backups from Hoststar

## Usage

### Configuration

You will need to place a configuration file into the [`config`](./config) folder called `config.json`. 
This file's content should look something like this:

```json
{
  "username": "username",
  "password": "password",
  "debug": true,
  "automaticOnly": true,
  "destDir": "."
}
```
with the appropriate values replaced with the values you need. 

The listing above shows the default config. If you do not specify one of the properties, the one above will be used.

### Backuping

You may run

```shell
node ./src/index.js
```

to start downloading the backups as specified in the configuration.
