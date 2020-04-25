
const path = require('path')
const dotenv = require('dotenv')

dotenv.config({path: path.join(__dirname, '../.env')})

const {AWS} = require('./awsConfig');
const apigatewayv2 = new AWS.ApiGatewayV2();
const lambda = new AWS.Lambda();

const DEFAULT_CORS_CONFIG = {
    AllowCredentials: false,
    AllowHeaders: [
        '*',
    ],
    AllowMethods: [
        '*',
    ],
    AllowOrigins: [
        '*',
    ],
    ExposeHeaders: [
        '*',
    ],
    MaxAge: 300
};

const getAuthorizer = async () => {
    return await apigatewayv2.getAuthorizer({
        ApiId: 'b0epxyhxyi',
        AuthorizerId: '6at800',
    }).promise();

}

const createApi = async (name, corsConfiguration = DEFAULT_CORS_CONFIG) => {
    return await apigatewayv2.createApi({
        Name: name,
        ProtocolType: 'HTTP',
        CorsConfiguration: corsConfiguration,
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

    /*{
      ApiEndpoint: 'https://b0epxyhxyi.execute-api.eu-west-2.amazonaws.com',
      ApiId: 'b0epxyhxyi',
      ApiKeySelectionExpression: '$request.header.x-api-key',
      CorsConfiguration: {
        AllowCredentials: false,
        AllowHeaders: [ '*' ],
        AllowMethods: [ '*' ],
        AllowOrigins: [ '*' ],
        ExposeHeaders: [ '*' ],
        MaxAge: 5
      },
      CreatedDate: 2020-04-24T14:09:29.000Z,
      Name: 'ajax-proxy-api',
      ProtocolType: 'HTTP',
      RouteSelectionExpression: '$request.method $request.path'
    }*/

};

const createRoute = async (ApiId = 'b0epxyhxyi') => {
    return await apigatewayv2.createRoute({
        ApiId,
        RouteKey: 'GET /getDestinations',
        Target: 'integrations/gztheh8',
        AuthorizationType: 'JWT',
        AuthorizerId: '6at800',
        // AuthorizationScopes: [
        //     'STRING_VALUE',
        //     /* more items */
        // ],
    }).promise();

}

const createIntegration = async (ApiId, IntegrationMethod, IntegrationUri) => {
    return await apigatewayv2.createIntegration({
        ApiId,
        IntegrationType: 'AWS_PROXY',
        IntegrationMethod: IntegrationMethod,
        IntegrationUri: IntegrationUri,
        // PayloadFormatVersion: '2.0',
        // ConnectionType: 'INTERNET',
        // CredentialsArn: null,
        // TimeoutInMillis: 30000,
        // TlsConfig: {
        //     ServerNameToVerify: 'STRING_VALUE'
        // }
    }).promise();
    /*{
      ConnectionType: 'INTERNET',
      Description: 'my desc',
      IntegrationId: 'gztheh8',
      IntegrationMethod: 'GET',
      IntegrationType: 'AWS_PROXY',
      IntegrationUri: 'arn:aws:lambda:eu-west-2:476388674417:function:getDestinations',
      PayloadFormatVersion: '2.0',
      TimeoutInMillis: 30000
    }*/

}

const createAuthorizer = async () => {
    return await apigatewayv2.createAuthorizer({
        ApiId: 'b0epxyhxyi',
        Name: 'myAuth',
        AuthorizerType: 'JWT',
        IdentitySource: ['$request.header.Authorization'],
        JwtConfiguration: {
            Audience: ['np3uv0f590piarr8sn52748lf'],
            Issuer: 'https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_wXoQcV0Zm',
        }
    }).promise();
    /*{
      AuthorizerId: '6at800',
      AuthorizerType: 'JWT',
      IdentitySource: [ '$request.header.Authorization' ],
      JwtConfiguration: {
        Audience: [ 'np3uv0f590piarr8sn52748lf' ],
        Issuer: 'https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_wXoQcV0Zm'
      },
      Name: 'myAuth'
    }*/

}

const createStage = async (ApiId, StageName, AutoDeploy) => {
    return await apigatewayv2.createStage({
        ApiId,
        StageName,
        AutoDeploy,
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

    /*{
      AutoDeploy: true,
      CreatedDate: 2020-04-24T17:36:33.000Z,
      DefaultRouteSettings: { DetailedMetricsEnabled: false },
      Description: 'my desc',
      LastUpdatedDate: 2020-04-24T17:36:33.000Z,
      RouteSettings: {},
      StageName: 'default',
      StageVariables: {},
      Tags: {}
    }*/

}


(async () => {
    // console.log(await apigatewayv2.getApi({ApiId: 'shwi3fcqr2'}).promise())
    /*
    {
  ApiEndpoint: 'https://shwi3fcqr2.execute-api.eu-west-2.amazonaws.com',
  ApiId: 'shwi3fcqr2',
  ApiKeySelectionExpression: '$request.header.x-api-key',
  CorsConfiguration: {
    AllowCredentials: false,
    AllowHeaders: [ '*' ],
    AllowMethods: [ 'GET', 'POST', 'DELETE', '*' ],
    AllowOrigins: [ '*' ],
    ExposeHeaders: [ '*' ],
    MaxAge: 300
  },
  CreatedDate: 2020-04-25T13:15:36.000Z,
  Name: 'u',
  ProtocolType: 'HTTP',
  RouteSelectionExpression: '$request.method $request.path',
  Tags: {}
}
     */

    // console.log(await apigatewayv2.getIntegration({ApiId: 'shwi3fcqr2', IntegrationId: '4g87ewo'}).promise())
    /*
    {
      ConnectionType: 'INTERNET',
      IntegrationId: '4g87ewo',
      IntegrationMethod: 'POST',
      IntegrationType: 'AWS_PROXY',
      IntegrationUri: 'arn:aws:lambda:eu-west-2:476388674417:function:aa',
      PayloadFormatVersion: '2.0',
      TimeoutInMillis: 30000
    }
     */

    // console.log(await apigatewayv2.getStage({ApiId: 'shwi3fcqr2', StageName: '$default'}).promise())
    /*
    {
  AutoDeploy: true,
  CreatedDate: 2020-04-25T13:15:38.000Z,
  DefaultRouteSettings: { DetailedMetricsEnabled: false },
  DeploymentId: 'howaxq',
  LastDeploymentStatusMessage: "Successfully deployed stage with deployment ID 'howaxq'",
  LastUpdatedDate: 2020-04-25T13:16:19.000Z,
  RouteSettings: {},
  StageName: '$default',
  StageVariables: {},
  Tags: {}
}
     */

    // console.log(await apigatewayv2.getRoute({ApiId: 'shwi3fcqr2', RouteId: '1kpk0q3'}).promise())
    /*
    {
  ApiKeyRequired: false,
  AuthorizationScopes: [],
  AuthorizationType: 'NONE',
  RequestParameters: {},
  RouteId: '1kpk0q3',
  RouteKey: 'GET /aa',
  Target: 'integrations/4g87ewo'
}
     */

    // console.log(
    //     JSON.parse(
    //         decodeURIComponent(
    //             (
    //                 await iam.getPolicyVersion({
    //                     PolicyArn: 'arn:aws:iam::476388674417:policy/service-role/AWSLambdaBasicExecutionRole-15072cb6-e1fa-4afa-9a73-9d266d9e58ee',
    //                     // PolicyArn: 'arn:aws:iam::476388674417:policy/my-path/my-policy',
    //                     VersionId: 'v1'
    //                 }).promise()
    //             ).PolicyVersion.Document
    //         )
    //     )
    // )

    // console.log(await iam.getPolicy({
    //     PolicyArn: 'arn:aws:iam::476388674417:policy/my-path/my-policy',
    // }).promise())


    //
    // await iam.createRole({
    // }).promise()
    //
    // await iam.attachRolePolicy({
    //
    // }).promise()

    // console.log(await iam.listAttachedRolePolicies({
    //     RoleName: 'aa-role-vf9iqqit',
    // }).promise())


    // console.log(await iam.getRole({RoleName: 'aa-role-vf9iqqit'}).promise())
    /*const a = {
        Path: '/service-role/',
        RoleName: 'aa-role-vf9iqqit',
        RoleId: 'AROAW52X2JNYTQVJZNMCO',
        Arn: 'arn:aws:iam::476388674417:role/service-role/aa-role-vf9iqqit',
        CreateDate: '2020-04-25T13:13:20.000Z',
        AssumeRolePolicyDocument: '%7B%22Version%22%3A%222012-10-17%22%2C%22Statement%22%3A%5B%7B%22Effect%22%3A%22Allow%22%2C%22Principal%22%3A%7B%22Service%22%3A%22lambda.amazonaws.com%22%7D%2C%22Action%22%3A%22sts%3AAssumeRole%22%7D%5D%7D',
        MaxSessionDuration: 3600,
        Tags: [],
        RoleLastUsed: {LastUsedDate: '2020-04-25T13:16:56.000Z', Region: 'eu-west-2'}
    }*/

    // await iam.createRole({
    //     Path,
    //     RoleName,
    //     AssumeRolePolicyDocument,
    //     Description,
    //     MaxSessionDuration,
    //     PermissionsBoundary,
    //     // Tags
    // }).promise()

    // console.log(await iam.listRolePolicies({RoleName:'aa-role-vf9iqqit'}).promise())


// getAuthorizer()

    // createAuthorizer()

//======================================================


    // await extracted();
    /*
    */

    // const {
    //     ApiEndpoint,
    //     ApiId
    // } = await createApi('my-api')
    //
    // await createStage(ApiId, '$default', true)
    //
    // const {
    //     IntegrationId,
    //     IntegrationUri
    // } = await createIntegration('b0epxyhxyi', 'POST', 'arn:aws:lambda:eu-west-2:476388674417:function:getDestinations')

    // createRoute()


    // console.log(await lambda.listFunctions().promise())
    // console.log(await lambda.getPolicy({FunctionName: 'aa'}).promise())

    /*const a = {
        Policy: JSON.stringify({
            Version: "2012-10-17",
            Id: "default",
            Statement: [{
                Sid: "c52510bc-06a9-5405-b6d8-3928554c04c1",
                Effect: "Allow",
                Principal: {
                    Service: "apigateway.amazonaws.com"
                },
                Action: "lambda:InvokeFunction",
                Resource: "arn:aws:lambda:eu-west-2:476388674417:function:aa",
                Condition: {
                    ArnLike: {
                        "AWS:SourceArn": "arn:aws:execute-api:eu-west-2:476388674417:shwi3fcqr2/!*!/!*!/aa"
                    }
                }
            }]
        }),
        RevisionId: '6cdd33b8-9aa0-4feb-9a20-e2ca273e4aec'
    }*/

})()
