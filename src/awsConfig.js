const AWS = require('aws-sdk');
const readPkgUp = require('read-pkg-up')
require('dotenv').config()

const {
    packageJson,
    path: packageJsonPath
} = readPkgUp.sync();

const {aws: config} = packageJson

config.accessKeyId = typeof config.accessKeyId === "string"
    ? config.accessKeyId
    : process.env[config.accessKeyId.env] || config.accessKeyId.default

config.secretAccessKey = typeof config.secretAccessKey === "string"
    ? config.secretAccessKey
    : process.env[config.secretAccessKey.env] || config.secretAccessKey.default

const {accessKeyId, secretAccessKey, region} = config

AWS.config.update({accessKeyId, secretAccessKey, region})

module.exports = {
    AWS,
    config,
    packageJson,
    packageJsonPath
}
