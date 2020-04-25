#!/usr/bin/env node

const chalk = require('chalk')
const md5File = require('md5-file')
const fs = require('fs');
const path = require('path');
const {zip} = require('zip-a-folder');
const prettyBytes = require('pretty-bytes');
const writeJson = require('write-json');
const {promisify} = require('util');
const execFile = promisify(require('child_process').execFile);
const ncp = promisify(require('ncp').ncp);
const {AWS, packageJson, packageJsonPath} = require("./awsConfig");
const {getProcessArgObject} = require("./util");

const relativeDepsToAbsolute = dependencies =>
    Object.entries(dependencies)
        .reduce((dependencies, [key, value]) => Object.assign(dependencies, {
            [key]: value.startsWith('file:')
                ? `file:${path.resolve(value.slice('file:'.length))}`
                : value
        }), {});

const symlinksToHardCopy = async targetPath => {
    const symlinkPaths = fs.readdirSync(targetPath, {withFileTypes: true})
        .filter(dirent => dirent.isSymbolicLink())
        .map(dirent => path.resolve(targetPath, dirent.name));

    for (const symlinkPath of symlinkPaths) {
        const realPath = fs.realpathSync(symlinkPath);
        fs.unlinkSync(symlinkPath)
        await ncp(realPath, symlinkPath);
    }
};

const buildLayer = async dest => {
    const nodejsPath = path.resolve(dest, 'nodejs')
    console.log(chalk.white.bold(`\nbuilding layer...`));
    fs.mkdirSync(nodejsPath, {recursive: true})

    writeJson.sync(path.resolve(nodejsPath, 'package.json'), {
        ...packageJson,
        dependencies: relativeDepsToAbsolute(packageJson.dependencies)
    });

    await execFile('npm', ['i', '--only=production', '--prefix', nodejsPath]);
    await symlinksToHardCopy(path.resolve(nodejsPath, 'node_modules'));
};

const zipLayer = async (src, dest) => {
    console.log('creating zip archive');
    await zip(src, dest);
    console.log(`${dest} - ${prettyBytes(fs.statSync(dest).size)}`);
    return fs.readFileSync(dest);
};

const deployLayer = async ({
    layerName: LayerName,
    description: Description,
    license: LicenseInfo,
    zipFile: ZipFile,
    runtimes: CompatibleRuntimes = ["nodejs12.x"],
}) => {
    console.log(chalk.white.bold('\ndeploying layer...'));
    return await new AWS.Lambda().publishLayerVersion({
        Content: {ZipFile},
        LayerName,
        CompatibleRuntimes,
        Description,
        LicenseInfo,
    }).promise();
};

const clean = dest => {
    if (fs.existsSync(dest)) {
        fs.rmdirSync(dest, {recursive: true})
    }
};

const findSameVersion = async (LayerName, hash) => {
    const {LayerVersions} = await new AWS.Lambda().listLayerVersions({LayerName}).promise();
    return LayerVersions.find(layerVersion => {
        const match = layerVersion.Description.match(/\[hash:(.*?)]/);
        return match && match[1] === hash;
    });
};

const getZippedLayer = async (fileName, basePath) => {
    const buildPath = path.resolve(basePath, 'build');
    const layerPath = path.resolve(buildPath, 'layer');
    clean(layerPath);
    await buildLayer(layerPath)
    const zipFile = await zipLayer(layerPath, path.resolve(buildPath, `${fileName}.zip`));
    clean(layerPath);
    return zipFile;
};

const deployNodeModulesAsLayer = async ({name} = {}) => {
    const {
        name: packageName,
        license,
        dependencies,
    } = packageJson;

    const layerName = name || `${packageName}_node_modules`;
    const hash = md5File.sync(packageJsonPath);
    const description = `production dependencies in package '${packageName}' [hash:${hash}]`;
    const packageRootPath = path.resolve(packageJsonPath, '..');

    console.log(chalk.yellow.bold(`\n❏ ${layerName}`) + chalk.grey(` - ${description}`))
    console.log('including:');
    console.log(chalk.magenta(Object
        .keys(dependencies)
        .map(packageName => `∙ ${packageName}`)
        .join('\n')));

    const sameVersion = await findSameVersion(layerName, hash);
    if (sameVersion) {
        console.log(chalk.white('The same version is already deployed.'));
        return sameVersion
    }

    const zipFile = await getZippedLayer(`${layerName}.${hash}`, packageRootPath);
    const deployedLayer = await deployLayer({layerName, license, description, zipFile});
    console.log('done.');
    return deployedLayer

};

if (require.main === module) {
    deployNodeModulesAsLayer(getProcessArgObject()).then(console.log, console.error)
} else {
    module.exports = deployNodeModulesAsLayer
}
