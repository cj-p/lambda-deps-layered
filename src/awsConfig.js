const AWS = require('aws-sdk');
const chalk = require('chalk');
const readPkgUp = require('read-pkg-up')
require('dotenv').config()

const checkConfig = (config, key) => {
    if (config[key] == null) {
        console.error(chalk.red('"accessKeyId" is not set.'))
        throw new Error()
    }
    if (config[key].isEmpty) {
        console.error(chalk.red(`environemt variable "${config[key].env}" is not set.`))
        throw new Error()
    }
}

const {
    packageJson,
    path: packageJsonPath
} = readPkgUp.sync();

if (!packageJson.aws) {
    console.error(chalk.red('"aws" field must be set in the "package.json"'))
    throw new Error()
}

const config = Object.entries(packageJson.aws).reduce((config, [key, value]) =>
    Object.assign(config, {
        [key]: typeof value === "string"
            ? value
            : process.env[value.env] || value.default ||
            (value.env ? {isEmpty: true, env: value.env} : null)
    }), {});

['accessKeyId', 'secretAccessKey', 'region'].forEach(key => checkConfig(config, key));

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
