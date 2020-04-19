const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const publishLayer = require('./publishLayer');
const publishFunction = require('./publishFunction');

let publishAllFunctionsWithLayer = async targetPath => {
    const functionRootPath = path.resolve(targetPath);
    const readdirSync = fs.readdirSync(functionRootPath, {withFileTypes: true});
    const functionPaths = readdirSync
        .filter(entry => entry.isDirectory())
        .map(entry => path.resolve(functionRootPath, entry.name))
        .filter(functionPath => fs.existsSync(path.resolve(functionPath, 'lambda.json')))

    console.log(chalk.green.underline('\nPublishing Layer'));

    const {LayerVersionArn} = await publishLayer();

    console.log(chalk.green.underline('\nPublishing Functions'));

    for (const functionPath of functionPaths) {
        try {
            await publishFunction(functionPath, {
                Layers: [LayerVersionArn]
            })
        } catch (e) {
            console.error(e)
        }
    }
};

if (require.main === module) {
    const pathArg = process.argv.slice(2).find(arg => !arg.startsWith('-'));
    publishAllFunctionsWithLayer(pathArg).then(console.log, console.error)
} else {
    module.exports = publishAllFunctionsWithLayer
}
