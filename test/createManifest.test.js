const createManifest = require('../src/createManifest');
const path = require('path');
const {expect} = require('chai');

const TEST_SOUCE_ROOT_PATH = path.resolve(__dirname, 'testSourceRoot');
const INVALID_SOURCES_PATH = path.resolve(__dirname, 'invalidSources');
const MULTIPLE_API_ANNOTATED_FUNCTION_ROOT_PATH = path.resolve(INVALID_SOURCES_PATH, 'multipleApiAnnotatedFunction');
const MULTIPLE_COMMENTS_FUNCTION_ROOT_PATH = path.resolve(INVALID_SOURCES_PATH, 'multipleCommentsFunction');

const ENV_PACKAGE_JSON = {
    "name": "my-env-package-name",
    "aws": {
        "accessKeyId": {
            "env": "ACCESS_KEY_ID"
        },
        "secretAccessKey": {
            "env": "SECRET_ACCESS_KEY"
        },
        "region": "my-region-1"
    }
}

const STATIC_PACKAGE_JSON = {
    "name": "my-static-package-name",
    "aws": {
        "accessKeyId": "MyAccessKeyId",
        "secretAccessKey": "MySecretAccessKey",
        "region": "my-region-1"
    }
}


describe('createManifest', () => {
    describe('parse package.json', () => {
        it('throw error when invalid package.json', () => {
            expect(() => {
                createManifest(TEST_SOUCE_ROOT_PATH, {})
            }).to.throws(TypeError, '"aws" field is required in package.json')

            expect(() => {
                createManifest(TEST_SOUCE_ROOT_PATH, {aws: {}})
            }).to.throws(TypeError, 'Missing fields in "aws" field in package.json : \n' +
                '\taccessKeyId\n' +
                '\tsecretAccessKey\n' +
                '\tregion')
        })

        it('throw error when environment variables specified in package.json is not set', () => {
            expect(() => createManifest(TEST_SOUCE_ROOT_PATH, ENV_PACKAGE_JSON)).to.throws(
                ReferenceError,
                'Missing environment variables : \n' +
                '\tACCESS_KEY_ID\n' +
                '\tSECRET_ACCESS_KEY'
            )
        })

        it('get apiId if it is specified package.json', () => {
            const {apiId} = createManifest(TEST_SOUCE_ROOT_PATH, {
                aws:{
                    packageName: "my-env-package-name",
                    accessKeyId: "MyAccessKeyId",
                    secretAccessKey: "MySecretAccessKey",
                    region: "my-region-1",
                    apiId:'myApiId'
                }
            });
            expect(apiId).to.equal('myApiId')
        })

        it('parse env variables specified package.json', () => {
            process.env["ACCESS_KEY_ID"] = "MyAccessKeyId";
            process.env["SECRET_ACCESS_KEY"] = "MySecretAccessKey";

            const {packageName, accessKeyId, secretAccessKey, region} = createManifest(TEST_SOUCE_ROOT_PATH, ENV_PACKAGE_JSON);
            expect({packageName, accessKeyId, secretAccessKey, region}).to.deep.equal({
                packageName: "my-env-package-name",
                accessKeyId: "MyAccessKeyId",
                secretAccessKey: "MySecretAccessKey",
                region: "my-region-1",
            })
        })

        it('parse static values specified package.json', () => {
            const {packageName, accessKeyId, secretAccessKey, region} = createManifest(TEST_SOUCE_ROOT_PATH, STATIC_PACKAGE_JSON);
            expect({packageName, accessKeyId, secretAccessKey, region}).to.deep.equal({
                packageName: "my-static-package-name",
                accessKeyId: "MyAccessKeyId",
                secretAccessKey: "MySecretAccessKey",
                region: "my-region-1",
            })
        })

        it('no cors setting if not exists', () => {
            expect(createManifest(TEST_SOUCE_ROOT_PATH, STATIC_PACKAGE_JSON).cors).to.be.undefined
        });

        it('parse cors setting if exists', () => {
            expect(createManifest(TEST_SOUCE_ROOT_PATH, {
                aws: {
                    ...STATIC_PACKAGE_JSON.aws,
                    cors: {
                        allowOrigins: ['testdomain.com'],
                        allowMethods: ['GET', 'POST', 'DELETE', '*'],
                        allowHeaders: ['X-My-Request-Header'],
                        exposeHeaders: ['X-My-Response-Header'],
                        allowCredentials: false,
                        maxAge: 300
                    }
                }
            }).cors).to.deep.equal({
                AllowOrigins: ['testdomain.com'],
                AllowMethods: ['GET', 'POST', 'DELETE', '*'],
                AllowHeaders: ['X-My-Request-Header'],
                ExposeHeaders: ['X-My-Response-Header'],
                AllowCredentials: false,
                MaxAge: 300
            })
        })

        it('when there is cors config, every cors setting fields are mandatory', () => {
            expect(() => createManifest(TEST_SOUCE_ROOT_PATH, {
                aws: {
                    ...STATIC_PACKAGE_JSON.aws,
                    cors: {}
                }
            }).cors).to.throw(TypeError, 'Missing fields in "aws.cors" field in package.json : \n' +
                '\tallowOrigins\n' +
                '\tallowMethods\n' +
                '\tallowHeaders\n' +
                '\texposeHeaders\n' +
                '\tallowCredentials\n' +
                '\tmaxAge')
        });
    })

    describe('parse function block comment apidoc annotations', () => {
        it('get routes info from only directories including "index.js" with block comment with "api" annotation', () => {
            expect(createManifest(TEST_SOUCE_ROOT_PATH, STATIC_PACKAGE_JSON).functions).to.deep.equal([{
                name: 'testFunction1',
                path: path.resolve(TEST_SOUCE_ROOT_PATH, 'testFunction1'),
                route: {
                    method: 'GET',
                    path: '/entities'
                },
                permissions: [
                    "myService1:MyAction1",
                    "myService2:MyAction2",
                ],
            }, {
                name: 'testFunction2',
                path: path.resolve(TEST_SOUCE_ROOT_PATH, 'testFunction2'),
                route: {
                    method: 'POST',
                    path: '/entities/:id'
                },
                permissions: [
                    "myService2:MyAction2",
                    "myService3:MyAction3",
                ]
            }, {
                name: 'testFunction3',
                path: path.resolve(TEST_SOUCE_ROOT_PATH, 'testFunction3'),
                route: {
                    method: 'DELETE',
                    path: '/entities/:id'
                },
                permissions: [
                    "myService1:MyAction1",
                    "myService3:MyAction3",
                    "myService4:MyAction4",
                ]
            }])
        })

        it('throws when comments with multiple api annotation is provided', () => {
            expect(() => createManifest(MULTIPLE_API_ANNOTATED_FUNCTION_ROOT_PATH, STATIC_PACKAGE_JSON))
                .throws(TypeError, 'There should be only one block comment containing one @Api annotation per each "index.js" file.');
        })
        it('throws when index file including multiple comments with api annotation is provided', () => {
            expect(() => createManifest(MULTIPLE_COMMENTS_FUNCTION_ROOT_PATH, STATIC_PACKAGE_JSON))
                .throws(TypeError, 'There should be only one block comment containing one @Api annotation per each "index.js" file.');
        })
    })
})
