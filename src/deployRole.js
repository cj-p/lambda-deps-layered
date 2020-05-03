#!/usr/bin/env node

const chalk = require('chalk');
const {diff} = require('fast-array-diff');
const camelCase = require('camelcase');
const {jsonEquals} = require("./util");
const {AWS, config} = require("./awsConfig");
const iam = new AWS.IAM();
const sts = new AWS.STS();

const getExistingPolicyStatement = async policyArn => {
    try {
        const {Policy: {DefaultVersionId}} = await iam.getPolicy({
            PolicyArn: policyArn
        }).promise();

        const {PolicyVersion: {Document}} = await iam.getPolicyVersion({
            VersionId: DefaultVersionId,
            PolicyArn: policyArn,
        }).promise();

        return JSON.parse(decodeURIComponent(Document)).Statement;
    } catch (e) {
        return null
    }
}

const pushNewPolicyVersion = async (policyArn, policyDocument) => {
    const {Versions: versions} = await iam.listPolicyVersions({PolicyArn: policyArn}).promise();
    const {length: versionCount, [versionCount - 1]: lastVersion} = versions.map(version => version.VersionId).sort();

    if (versionCount >= 5) {
        await iam.deletePolicyVersion({
            PolicyArn: policyArn,
            VersionId: lastVersion,
        }).promise()
    }

    return iam.createPolicyVersion({
        PolicyArn: policyArn,
        PolicyDocument: policyDocument,
        SetAsDefault: true,
    }).promise();
};

function getBasicLogPolicyStatments(accountResource, functionResources) {
    return [{
        Effect: "Allow",
        Action: "logs:CreateLogGroup",
        Resource: `${accountResource}:*`
    }, {
        Effect: "Allow",
        Action: [
            "logs:CreateLogStream",
            "logs:PutLogEvents"
        ],
        Resource: functionResources,
    }];
}

const getFunctionArn = (accountResource, functionName) => `${accountResource}:log-group:/aws/lambda/${functionName}:*`;

const savePolicy = async ({
    region,
    accountId,
    path,
    policyName,
    functions = []
}) => {
    const accountResource = `arn:aws:logs:${region}:${accountId}`;
    const policyDocumentObject = ({
        Version: "2012-10-17",
        Statement: [
            ...getBasicLogPolicyStatments(
                accountResource,
                functions.map(functionInfo => getFunctionArn(accountResource, functionInfo.name))
            ),
            ...functions.map(functionInfo => ({
                    Effect: "Allow",
                    Action: functionInfo.permissions,
                    Resource: getFunctionArn(accountResource, functionInfo.name),
                }
            ))
        ]
    });

    let numbering = ''

    while (true) {
        const numberedPolicyName = policyName + numbering;
        console.log('');
        console.log(chalk.yellow.bold(`Policy: ${path}${numberedPolicyName}`));
        console.log(chalk.white(`checking existing policy...`));

        const destinedArn = `arn:aws:iam::${accountId}:policy${path}${numberedPolicyName}`;

        console.log(destinedArn);

        const currentPolicyStatement = await getExistingPolicyStatement(destinedArn);

        if (!currentPolicyStatement) {
            try {
                console.log(chalk.white(`creating new policy...`));

                const {Policy: {Arn}} = await iam.createPolicy({
                    PolicyName: numberedPolicyName,
                    Path: path,
                    PolicyDocument: JSON.stringify(policyDocumentObject)
                }).promise();
                return Arn
            } catch (e) {
                if (e.code !== 'EntityAlreadyExists') break
                numbering = +(numbering + 1)
                console.log(chalk.white(`policy with the name exists. trying to another name(${numbering})...`));
                continue
            }
        }

        console.log(chalk.white(`a policy is already exist,`));
        if (jsonEquals(policyDocumentObject.Statement, currentPolicyStatement)) {
            console.log(chalk.white(`and does not need to be updated.`));
        } else {
            console.log(chalk.white(`creating new version....`));
            await pushNewPolicyVersion(destinedArn, JSON.stringify(policyDocumentObject))
        }

        return destinedArn
    }
};

async function getCurrentRole(roleName) {
    try {
        const {Role} = await iam.getRole({
            RoleName: roleName
        }).promise();
        return Role
    } catch (e) {
        return null
    }
}

const updateRole = async (roleName, assumeRolePolicyDocument, policyArns) => {
    console.log(chalk.magenta('assumeRolePolicy...'));
    await iam.updateAssumeRolePolicy({
        RoleName: roleName,
        PolicyDocument: assumeRolePolicyDocument
    }).promise();

    const {AttachedPolicies} = await iam.listAttachedRolePolicies({RoleName: roleName}).promise();
    const attachedPolicyArns = AttachedPolicies.map(value => value.PolicyArn);

    console.log(chalk.magenta('attachRolePolicy...'));
    const {added, removed} = diff(attachedPolicyArns, policyArns);

    const adding = added.map(arn => iam.attachRolePolicy({
        PolicyArn: arn,
        RoleName: roleName
    }).promise());

    const removing = removed.map(arn => iam.detachRolePolicy({
        PolicyArn: arn,
        RoleName: roleName
    }).promise());

    return Promise.all([...adding, ...removing])
};

const saveLambdaRole = async ({path, roleName, policyArns = []}) => {
    const assumeRolePolicyDocument = JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: 'Allow',
            Principal: {
                Service: 'lambda.amazonaws.com'
            },
            Action: 'sts:AssumeRole'
        }]
    });

    console.log('');
    console.log(chalk.yellow.bold(`Role: ${path}${roleName}`));
    console.log(chalk.white(`checking existing role...`));

    const currentRole = await getCurrentRole(roleName);

    if (currentRole) {
        console.log(chalk.white(`a role is already exist.\nupdating:`));
        await updateRole(roleName, assumeRolePolicyDocument, policyArns);
        return currentRole.Arn
    }

    console.log(chalk.white(`creating new role...`));
    const {Role: role} = await iam.createRole({
        Path: path,
        RoleName: roleName,
        AssumeRolePolicyDocument: assumeRolePolicyDocument
        //     Tags,
        //     Description,
        //     PermissionsBoundary,
        //     MaxSessionDuration,
    }).promise();

    for (const PolicyArn of policyArns) {
        await iam.attachRolePolicy({
            PolicyArn,
            RoleName: role.RoleName
        }).promise()
    }

    return role.Arn
};

const deployRole = async () => {
    const {packageName, region, functions} = config;
    const path = '/lambdapress-roles/'

    const policyArn = await savePolicy({
        region,
        path,
        functions,
        accountId: (await sts.getCallerIdentity().promise()).Account,
        policyName: `${camelCase(packageName)}LambdaExecutionRole`,
    });

    return saveLambdaRole({path, roleName: `${packageName}-role`, policyArns: [policyArn]});
};

if (require.main === module) {
    deployRole().then(console.log, console.error)
} else {
    module.exports = deployRole
}
