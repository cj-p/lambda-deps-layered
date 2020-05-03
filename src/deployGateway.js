#!/usr/bin/env node

const camelCase = require('camelcase');
const chalk = require('chalk');
const fs = require('fs');
const packageJsonEditor = require('package-json-editor/src')
const {AWS, config, packageJsonPath} = require('./awsConfig');
const deployFunction = require('./deployFunction')
const {extract} = require('./util');

const apigatewayv2 = new AWS.ApiGatewayV2();
const lambda = new AWS.Lambda();

const getExistingApi = async ApiId => {
    const existingApi = ApiId && await apigatewayv2.getApi({ApiId}).promise();
    if (existingApi.ProtocolType !== 'HTTP') throw Object.assign(new Error(), {code: 'NotFoundException'})
    return existingApi
}

const getExistingApiAndPrintError = async apiId => {
    try {
        return getExistingApi(apiId)
    } catch (e) {
        if (e.code === 'NotFoundException') {
            console.log(chalk.red(
                'Error getting existing API :\n' +
                `API with id:${apiId} is not exists.\n\n` +
                'To create a new API automatically, delete "apiId" field from "package.json" and try again.'
            ))
        }
        throw e
    }
}

const saveApi = async (name, apiId, corsConfig) => {
    const existingApi = apiId && await getExistingApiAndPrintError(apiId);

    if (existingApi && existingApi.ApiId) {
        console.log(chalk.white(`Updating API ${existingApi.Name} (id:${existingApi.ApiId})...`))
        return apigatewayv2.updateApi({
            ApiId: existingApi.ApiId,
            Name: name,
            ...corsConfig ? {
                CorsConfiguration: corsConfig,
            } : {}
        }).promise()
    }

    console.log(chalk.white(`Creating API ${name}...`))
    return apigatewayv2.createApi({
        Name: name,
        ProtocolType: 'HTTP',
        ...corsConfig ? {
            CorsConfiguration: corsConfig,
        } : {}
        // ApiKeySelectionExpression: 'STRING_VALUE',
        // CredentialsArn: 'STRING_VALUE',
        // Description: 'STRING_VALUE',
        // DisableSchemaValidation: true || false,
        // RouteKey: 'STRING_VALUE',
        // RouteSelectionExpression: 'STRING_VALUE',
        // Tags: {
        //     '<__string>': 'STRING_VALUE',
        //     /* '<__string>': ... */
        // },
        // Target: 'STRING_VALUE',
        // Version: 'STRING_VALUE'
    }).promise();
};

const saveDefaultStage = async (apiId, autoDeploy) => {
    try {
        const existingStage = await apigatewayv2.getStage({
            ApiId: apiId,
            StageName: '$default'
        }).promise();

        console.log(chalk.white(`Updating existing '$default' stage...`))
        await apigatewayv2.updateStage({
            ApiId: apiId,
            StageName: '$default',
            AutoDeploy: autoDeploy,
        }).promise()

        return existingStage
    } catch (e) {
        if (e.code !== 'NotFoundException') throw e
        console.log(chalk.white(`Creating new '$default' stage...`))
        return apigatewayv2.createStage({
            ApiId: apiId,
            StageName: '$default',
            AutoDeploy: autoDeploy,
            // Description: 'my desc',
            // AccessLogSettings: {
            //     DestinationArn: 'STRING_VALUE',
            //     Format: 'STRING_VALUE'
            // },
            // ClientCertificateId: 'STRING_VALUE',
            // DefaultRouteSettings: {
            //     DataTraceEnabled: true || false,
            //     DetailedMetricsEnabled: true || false,
            //     LoggingLevel: ERROR | INFO | OFF,
            //     ThrottlingBurstLimit: 'NUMBER_VALUE',
            //     ThrottlingRateLimit: 'NUMBER_VALUE'
            // },
            // RouteSettings: {
            //     '<__string>': {
            //         DataTraceEnabled: true || false,
            //         DetailedMetricsEnabled: true || false,
            //         LoggingLevel: ERROR | INFO | OFF,
            //         ThrottlingBurstLimit: 'NUMBER_VALUE',
            //         ThrottlingRateLimit: 'NUMBER_VALUE'
            //     },
            //     /* '<__string>': ... */
            // },
            // DeploymentId: 'STRING_VALUE',
            // StageVariables: {
            //     '<__string>': 'STRING_VALUE',
            //     /* '<__string>': ... */
            // },
            // Tags: {
            //     '<__string>': 'STRING_VALUE',
            //     /* '<__string>': ... */
            // }
        }).promise();
    }
};

const saveRoute = async ({
    apiId,
    method,
    path,
    integrationId,
    authorizationType,
    authorizerId
}) => {
    const routeKey = `${method} ${path}`;
    const target = `integrations/${integrationId}`;

    console.log(chalk.white('Checking existing route...'));
    const {Items: routes} = await apigatewayv2.getRoutes({ApiId: apiId}).promise();
    const existing = routes.find(route => route.RouteKey === routeKey && route.Target === target)

    if (existing) {
        console.log(chalk.white(`Updating existing route...`));
        return apigatewayv2.updateRoute({
            ApiId: apiId,
            RouteId: existing.RouteId,
            AuthorizationType: authorizationType,
            AuthorizerId: authorizerId,
        }).promise()
    }

    console.log(chalk.white('Creating route...'));

    return apigatewayv2.createRoute({
        ApiId: apiId,
        RouteKey: routeKey,
        Target: target,
        AuthorizationType: authorizationType,
        AuthorizerId: authorizerId,
        // AuthorizationScopes: [
        //     'STRING_VALUE',
        //     /* more items */
        // ],
    }).promise();
}

const getIntegrationSaverForApi = async ApiId => {
    const {Items: existingIntegrations} = await apigatewayv2.getIntegrations({ApiId}).promise();

    return async (ApiId, IntegrationMethod, IntegrationUri) => {
        console.log(chalk.white('Checking existing Integration...'));
        const existing = existingIntegrations.find(integration =>
            integration.IntegrationUri === IntegrationUri &&
            integration.IntegrationMethod === IntegrationMethod);

        if (existing) {
            console.log(chalk.white('Integration already exists.'));
            return existing
        }

        console.log(chalk.white('Creating Integration...'));
        return await apigatewayv2.createIntegration({
            ApiId,
            IntegrationType: 'AWS_PROXY',
            IntegrationMethod: IntegrationMethod,
            IntegrationUri: IntegrationUri,
            PayloadFormatVersion: '2.0',
            // ConnectionType: 'INTERNET',
            // CredentialsArn: null,
            // TimeoutInMillis: 30000,
            // TlsConfig: {
            //     ServerNameToVerify: 'STRING_VALUE'
            // }
        }).promise();
    };
}

function getDeployedFunctionInfos(deployedFunctions) {
    const functionIndexes = config.functions.reduce((functionIndexes, {name, ...infos}) => ({
        ...functionIndexes,
        [name]: infos
    }), {});

    return deployedFunctions.map(({FunctionName, FunctionArn}) => ({
        name: FunctionName,
        arn: FunctionArn,
        ...functionIndexes[FunctionName],
    }));
}

const addPermissionIfNotExists = async (statementId, functionArn) => {
    const {Policy} = await lambda.getPolicy({FunctionName: functionArn}).promise();
    const {Statement:statements} = JSON.parse(Policy)

    if(statements.find(statement => statement.Sid === statementId)){
        console.log(chalk.white("Permission already exists."))
        return
    }

    console.log(chalk.white("Add permission for gateway to invoke function..."))
    await lambda.addPermission({
        FunctionName: functionArn,
        Action: "lambda:InvokeFunction",
        Principal: "apigateway.amazonaws.com",
        StatementId: statementId
    }).promise();
};

const updatePackageJsonApiId = (packageJsonPath, ApiId) => {
    if(!ApiId) return;
    console.log(chalk.white(`Saving apiId: ${ApiId} in "package.json"...`))
    fs.writeFileSync(
        packageJsonPath,
        packageJsonEditor(fs.readFileSync(packageJsonPath, 'utf-8'))
            .set('aws.apiId', ApiId)
            .toString())
};

const deployGateway = async () => {
    const functionDeployResult = await deployFunction();
    const functionInfos = getDeployedFunctionInfos(functionDeployResult);

    console.log(chalk.green.underline('\n\n●  Deploying Gateways\n'));
    const {ApiId: apiId, Name: apiName, ApiEndpoint:apiEndpoint} = await saveApi(camelCase(config.packageName), config.apiId);
    updatePackageJsonApiId(packageJsonPath, apiId);
    await saveDefaultStage(apiId, true);

    const saveIntegration = await getIntegrationSaverForApi(apiId)
    for (const {arn, route} of functionInfos) {
        console.log(chalk.yellow.bold(`\n${route.method} ${route.path}`))
        const {IntegrationId: integrationId} = await saveIntegration(apiId, route.method, arn)
        await saveRoute({
            apiId: apiId,
            method: route.method,
            path: route.path,
            integrationId: integrationId,
            // authorizationType: 'JWT',
            // authorizerId:'',
        });
        await addPermissionIfNotExists(camelCase(`allow ${apiName} to invoke`), arn);
        console.log(`${route.method} ${apiEndpoint}${route.path}`)
    }
};

deployGateway()

module.exports = deployGateway
