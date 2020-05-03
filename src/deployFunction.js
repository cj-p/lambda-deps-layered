#!/usr/bin/env node

const fs = require('fs');
const chalk = require('chalk');
const path = require('path')
const {zip} = require('zip-a-folder');
const prettyBytes = require('pretty-bytes');
const {ncp} = require('ncp');
const {hashElement} = require('folder-hash');
const {AWS, config, packageJsonPath} = require("./awsConfig");
const deployRole = require('./deployRole');
const deployLayer = require('./deployLayer');

const DEFAULT_CONFIG = {
    Handler: "index.handler",
    MemorySize: 256,
    Runtime: "nodejs12.x",
    Timeout: 15,
    // Description: "lambda function",
    // Environment: {
    //     Variables: {
    //         "BUCKET": "my-bucket-1xpuxmplzrlbh",
    //         "PREFIX": "inbound"
    //     }
    // },
    // KMSKeyArn: "arn:aws:kms:us-west-2:123456789012:key/b0844d6c-xmpl-4463-97a4-d49f50839966",
    // Tags: {
    //     "DEPARTMENT": "Assets"
    // },
    // TracingConfig: {
    //     Mode: "Active"
    // }
};

const lambda = new AWS.Lambda();

const getExistingFunction = async FunctionName => {
    try {
        return await lambda.getFunction({FunctionName}).promise();
    } catch (e) {
        if (e.code === 'ResourceNotFoundException') return false
        throw e
    }
}

const zipFunction = async (src, dest) => {
    console.log('creating zip archive');
    await zip(src, dest);
    console.log(`${dest} - ${prettyBytes(fs.statSync(dest).size)}`);
    return fs.readFileSync(dest);
};

const updateFunction = async (config, zipFile) => {
    console.log(chalk.white.bold('updating function code...'));
    await lambda.updateFunctionCode({
        FunctionName: config.FunctionName,
        ZipFile: zipFile,
        Publish: true,
    }).promise()

    return await lambda.updateFunctionConfiguration(config).promise()
};

const createFunction = (config, zipFile) => {
    console.log(chalk.white.bold('creating new function...'));
    return lambda.createFunction({
        ...config,
        Publish: true,
        Code: {
            ZipFile: zipFile
        },
    }).promise()
};

const copy = (source, destination, options = {}) => new Promise((resolve, reject) => {
    if (!fs.existsSync(destination)) fs.mkdirSync(destination, {recursive: true})
    ncp(source, destination, options, err => err ? reject(err) : resolve());
});

const clean = zipSourcePath => {
    if (fs.existsSync(zipSourcePath)) fs.rmdirSync(zipSourcePath, {recursive: true})
};

const deployFunction = async (functionPath, functionName, role, extraConfig = {}) => {
    const packageRootPath = path.resolve(packageJsonPath, '..')
    const buildPath = path.resolve(packageRootPath, 'build')
    const config = {
        FunctionName: functionName,
        Role: role,
        ...DEFAULT_CONFIG,
        ...extraConfig,
    };

    console.log(chalk.yellow.bold(`\nƒ ${config.FunctionName}${
        config.Description
            ? chalk.gray(` - ${config.Description}`)
            : ''
    }`));

    const zipSourcePath = path.resolve(buildPath, config.FunctionName);
    clean(zipSourcePath);

    console.log(chalk.white.bold(`building function...`));
    await copy(functionPath, zipSourcePath, {filter: name => !name.endsWith('/lambda.json')});
    const {hash} = await hashElement(zipSourcePath, {algo: 'md5', encoding: 'hex'})
    const zipFile = await zipFunction(zipSourcePath, path.resolve(buildPath, `${config.FunctionName}.${hash}.zip`));
    clean(zipSourcePath);

    return await getExistingFunction(config.FunctionName)
        ? await updateFunction(config, zipFile)
        : await createFunction(config, zipFile)
};

const deployAllFunctions = async () => {
    console.log(chalk.green.underline('\n\n●  Deploying Roles'));
    const RoleArn = await deployRole();

    console.log(chalk.green.underline('\n\n●  Deploying Layer'));
    const {LayerVersionArn} = await deployLayer();

    console.log(chalk.green.underline('\n\n●  Deploying Functions'));

    const functions = [];
    for (const {name, path} of config.functions) {
        try {
            const functionInfo = await deployFunction(path, name, RoleArn, {Layers: [LayerVersionArn]});
            functions.push(functionInfo)
        } catch (e) {
            console.error(e)
        }
    }
    return functions
};

if (require.main === module) {
    deployAllFunctions().then(console.log, console.error)
} else {
    module.exports = deployAllFunctions
}
