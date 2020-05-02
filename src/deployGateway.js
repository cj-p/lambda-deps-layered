#!/usr/bin/env node

const chalk = require('chalk');
const {diff} = require('fast-array-diff');
const camelCase = require('camelcase');
const {jsonEquals} = require("./util");
const {AWS, config, packageJson} = require("./awsConfig");
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

const createDefaultLambdaPolicy = ({region, accountId, functionNames = []}) => [
    {
        Effect: "Allow",
        Action: "logs:CreateLogGroup",
        Resource: `arn:aws:logs:${region}:${accountId}:*`
    },
    {
        Effect: "Allow",
        Action: [
            "logs:CreateLogStream",
            "logs:PutLogEvents"
        ],
        Resource: functionNames.map(functionName =>
            `arn:aws:logs:${region}:${accountId}:log-group:/aws/lambda/${functionName}:*`
        )
    },
];


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

const createOrUpdatePolicy = async ({
    region,
    accountId,
    path,
    policyName,
    extraPolicyStatements = [],
    functionNames = []
}) => {
    const destinedArn = `arn:aws:iam::${accountId}:policy${path}${policyName}`;
    const policyDocumentObject = {
        Version: "2012-10-17",
        Statement: [
            ...createDefaultLambdaPolicy({
                region: region,
                accountId: accountId,
                functionNames,
            }),
            ...extraPolicyStatements
        ]
    };

    console.log('');
    console.log(chalk.yellow.bold(`Policy: ${path}${policyName}`));
    console.log(chalk.white(`checking existing policy...`));

    const currentPolicyStatement = await getExistingPolicyStatement(destinedArn);

    if (!currentPolicyStatement) {
        console.log(chalk.white(`creating new policy...`));
        const {Policy: {Arn}} = await iam.createPolicy({
            PolicyName: policyName,
            Path: path,
            PolicyDocument: JSON.stringify(policyDocumentObject)
        }).promise();
        return Arn
    }

    console.log(chalk.white(`a policy is already exist,`));
    if (jsonEquals(policyDocumentObject.Statement, currentPolicyStatement)) {
        console.log(chalk.white(`and does not need to be updated.`));
    } else {
        console.log(chalk.white(`creating new version....`));
        await pushNewPolicyVersion(destinedArn, JSON.stringify(policyDocumentObject))
    }

    return destinedArn
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
    console.log(chalk.magenta('\tassumeRolePolicy...'));
    await iam.updateAssumeRolePolicy({
        RoleName: roleName,
        PolicyDocument: assumeRolePolicyDocument
    }).promise();

    const {AttachedPolicies} = await iam.listAttachedRolePolicies({RoleName: roleName}).promise();
    const attachedPolicyArns = AttachedPolicies.map(value => value.PolicyArn);

    console.log(chalk.magenta('\tattachRolePolicy...'));
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

const createOrUpdateLambdaRole = async ({path, roleName, policyArns = []}) => {
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

const deployRole = async ({path = '/lambdapress-roles/', functionNames = []}) => {
    const {region} = config;
    const {name} = packageJson;
    const {Account: accountId} = await sts.getCallerIdentity().promise();
    const policyName = `${camelCase(name)}LambdaExecutionRole`;
    const roleName = `${name}-role`;

    return createOrUpdateLambdaRole({
        path,
        roleName,
        policyArns: [
            await createOrUpdatePolicy({
                region,
                accountId,
                path,
                policyName,
                functionNames,
            })]
    });
};

if (require.main === module) {
    const {function: functionNames} = getProcessArgObject();
    deployRole({functionNames}).then(console.log, console.error)
} else {
    module.exports = deployRole
}
