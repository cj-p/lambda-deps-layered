const path = require('path')
const dotenv = require('dotenv')

dotenv.config({path: path.join(__dirname, '../.env')})

const {AWS} = require('./awsConfig');
const apigatewayv2 = new AWS.ApiGatewayV2();

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

const getAuthorizer = () => apigatewayv2.getAuthorizer({
    ApiId: 'b0epxyhxyi',
    AuthorizerId: '6at800',
}).promise()

const createAuthorizer = () => apigatewayv2.createAuthorizer({
    ApiId: 'b0epxyhxyi',
    Name: 'myAuth',
    AuthorizerType: 'JWT',
    IdentitySource: ['$request.header.Authorization'],
    JwtConfiguration: {
        Audience: ['np3uv0f590piarr8sn52748lf'],
        Issuer: 'https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_wXoQcV0Zm',
    }
}).promise();


getAuthorizer()
createAuthorizer()

//======================================================

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
