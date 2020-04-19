#!/usr/bin/env node

const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const deployLayer = require('./deployLayer');
const deployFunction = require('./deployFunction');

let deployAllFunctionsWithLayer = async targetPath => {
    const functionRootPath = path.resolve(targetPath);
    const readdirSync = fs.readdirSync(functionRootPath, {withFileTypes: true});
    const functionPaths = readdirSync
        .filter(entry => entry.isDirectory())
        .map(entry => path.resolve(functionRootPath, entry.name))
        .filter(functionPath => fs.existsSync(path.resolve(functionPath, 'lambda.json')))

    console.log(chalk.green.underline('\nDeploying Layer'));

    const {LayerVersionArn} = await deployLayer();

    console.log(chalk.green.underline('\nDeploying Functions'));

    for (const functionPath of functionPaths) {
        try {
            await deployFunction(functionPath, {
                Layers: [LayerVersionArn]
            })
        } catch (e) {
            console.error(e)
        }
    }
};

if (require.main === module) {
    const pathArg = process.argv.slice(2).find(arg => !arg.startsWith('-'));
    deployAllFunctionsWithLayer(pathArg)
} else {
    module.exports = deployAllFunctionsWithLayer
}
