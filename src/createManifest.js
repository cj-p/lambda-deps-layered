const parse = require('comment-parser');
const path = require('path');
const fs = require('fs');
const {requireOnly, distinct, mapExtract, extract} = require("./util");

class MultipleApiSettingError extends TypeError {
    constructor() {
        super('There should be only one block comment containing one @Api annotation per each "index.js" file.');
    }
}

const resolveEnvVariable = value =>
    value.env
        ? process.env[value.env] || new ReferenceError(value.env)
        : value;

const getEnvVarRefErrors = configuration => Object
    .values(configuration)
    .filter(value => value instanceof ReferenceError);

const mergeAndThrowErrors = (message, envVarRefErrors) => {
    if (envVarRefErrors.length > 0) {
        throw new ReferenceError([message + ' : ']
            .concat(envVarRefErrors.map(err => `\t${err.message}`))
            .join('\n'))
    }
}

const handleMissingFieldNames = (configuration, message, fieldNames) => {
    const missingFieldNames = fieldNames.filter(value => configuration[value] == null)
    if (missingFieldNames.length > 0) {
        throw new TypeError([message + ' : ']
            .concat(missingFieldNames.map(fieldName => `\t${fieldName}`))
            .join('\n'))
    }
}

const getConfiguration = ({aws}) => {
    if (aws == null) throw new TypeError('"aws" field is required in package.json')
    return Object.entries(aws).reduce((config, [key, value]) => ({
        ...config,
        [key]: resolveEnvVariable(value)
    }), {});
};

const parseFunctionComments = functionsParentPath => fs
    .readdirSync(functionsParentPath, {withFileTypes: true})
    .filter(entry => entry.isDirectory())
    .map(entry => [entry.name, path.resolve(functionsParentPath, entry.name, 'index.js')])
    .filter(([, indexPath]) => fs.existsSync(indexPath))
    .map(([name, indexPath]) => [name, parse(fs.readFileSync(indexPath).toString())])
    .filter(([, comments]) => comments.find(comment =>
        comment.tags &&
        comment.tags.find &&
        comment.tags.find(tag => tag.tag === 'api')))
    .map(([name, comments]) => {
        const handlerFunctionComment = requireOnly(comments, new MultipleApiSettingError());

        const handlerFunctionTags = handlerFunctionComment.tags;

        const apiSetting = handlerFunctionTags
            .filter(tagInfo => tagInfo.tag === 'api')
            .map(tagInfo => ({
                method: tagInfo.type.toUpperCase(),
                routePath: tagInfo.name
            }));

        const {method, routePath} = requireOnly(apiSetting, new MultipleApiSettingError());

        return {
            name,
            path:path.resolve(functionsParentPath, name),
            permissions: handlerFunctionTags
                .filter(tagInfo => tagInfo.tag === 'apiPermission')
                .map(tagInfo => tagInfo.name),
            route:{
                method,
                path: routePath,
            }
        }
    });

const createManifest = (functionsParentPath, packageJson) => {
    const configuration = getConfiguration(packageJson)
    mergeAndThrowErrors('Missing environment variables', getEnvVarRefErrors(configuration))
    handleMissingFieldNames(configuration, 'Missing fields in "aws" field in package.json', [
        'accessKeyId',
        'secretAccessKey',
        'region'
    ])

    if (configuration.cors) {
        handleMissingFieldNames(configuration.cors, 'Missing fields in "aws.cors" field in package.json', [
            'allowOrigins',
            'allowMethods',
            'allowHeaders',
            'exposeHeaders',
            'allowCredentials',
            'maxAge',
        ])
    }

    const functionInfos = parseFunctionComments(functionsParentPath);

    return {
        ...extract(
            'accessKeyId',
            'secretAccessKey',
            'region'
        )(configuration),
        ...configuration.cors ? {
            cors: mapExtract({
                AllowOrigins: 'allowOrigins',
                AllowMethods: 'allowMethods',
                AllowHeaders: 'allowHeaders',
                ExposeHeaders: 'exposeHeaders',
                AllowCredentials: 'allowCredentials',
                MaxAge: 'maxAge',
            })(configuration.cors),
        } : {},
        packageName: packageJson.name,
        permissions: distinct(functionInfos.flatMap(functionInfo => functionInfo.permissions)),
        functions: functionInfos.map(functionInfo => extract(
            'name',
            'path',
            'permissions',
            'route'
        )(functionInfo)),
    }
}

module.exports = createManifest
