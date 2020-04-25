#!/usr/bin/env node

const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const deployRole = require('./deployRole');
const deployLayer = require('./deployLayer');
const deployFunction = require('./deployFunction');

let deployAllFunctionsWithLayer = async targetPath => {
    const functionRootPath = path.resolve(targetPath);
    const functions = fs
        .readdirSync(functionRootPath, {withFileTypes: true})
        .filter(entry => entry.isDirectory())
        .map(entry => ({
            path: path.resolve(functionRootPath, entry.name),
            name: entry.name,
        }));

    console.log(chalk.green.underline('\nDeploying Roles'));

    const RoleArn = await deployRole({functionNames: functions.map(entry => entry.name)});

    console.log(chalk.green.underline('\nDeploying Layer'));

    const {LayerVersionArn} = await deployLayer();

    console.log(chalk.green.underline('\nDeploying Functions'));

    for (const {path, name} of functions) {
        try {
            await deployFunction(path, name, RoleArn, {
                Layers: [LayerVersionArn]
            })
        } catch (e) {
            console.error(e)
        }
    }
};

if (require.main === module) {
    const pathArg = process.argv.slice(2).find(arg => !arg.startsWith('-'));
    deployAllFunctionsWithLayer(pathArg).then(console.log, console.error)
} else {
    module.exports = deployAllFunctionsWithLayer
}
