const AWS = require('aws-sdk');
const chalk = require('chalk');
const path = require('path');
const readPkgUp = require('read-pkg-up')
const createManifest = require('./createManifest')
require('dotenv').config()

const {packageJson, path: packageJsonPath} = readPkgUp.sync();

try {
    const config = createManifest(path.resolve(packageJsonPath, '../src'), packageJson);

    AWS.config.update({
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        region: config.region
    })

    module.exports = {
        AWS,
        config,
        packageJson,
        packageJsonPath
    }
} catch (e) {
    console.error(chalk.red(e.message))
}




