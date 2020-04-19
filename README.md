# lambda-deps-layered

Deploy AWS Lambda functions with layered dependencies

## Setup
`npm i -D lambda-deps-layered`


## Example

### AWS

First, create your **access key** at https://console.aws.amazon.com/iam/home#/security_credentials if you don't have one.
Then set access key informations in the `package.json` and `.env` in your package root.  
You may also need to create an appropriate **Role** at https://console.aws.amazon.com/iam/home#/roles for executing your function.

### Package structure

```
.
├── .env                // overrides system env variables
├── package.json        // add 'aws' field in this file
├── node_modules        // this will be converted to layer excluding dev dependencies
│
├── src
│   ├── function1       // lambda function module
│   │   ├── index.js    // function source
│   │   └── lambda.json // per function configuration
│   │ 
│   ├── function2
│   ...
│
└── lib/hello-world     // this also can be included to layer via adding as dependency
    ├── index.js
    └── package.json    // created by 'npm init'
```

### Configuration

```js
/* package.json */
{
  "dependencies": { // will be included to layer
    "random-quotes": "^1.3.0",
    "hello-world": "file:lib/hello-world", // added by "npm i ./lib/hello-world"
    ...
  },
  "aws": { // aws setting
    "accessKeyId": { "env": "MY_AWS_ACCESS_KEY_ID" },
    "secretAccessKey": { "env": "MY_AWS_SECRET_ACCESS_KEY" },
    "region": "eu-west-2",
  }
}


/* .env */
MY_AWS_ACCESS_KEY_ID=<YOUR_ACCESS_KEY_ID>
MY_AWS_SECRET_ACCESS_KEY=<YOUR_SECRET_ACCESS_KEY>
```

### Functions
```js
/* src/function1/index.js */
const randomQuotes = require('random-quotes');
const helloWorld = require('hello-world');

//as default 'Handler' setting is "index.handler"
exports.handler = async (event, context) => ({ 
    qoutes: randomQuotes(),
    greeting: helloWorld(),
});

/* src/function1/lambda.json */
{ "Role": "arn:aws:iam::<Role_Arn_Id>" }
```
run `deployAll ./src` on CLI

result:
```
Deploying Layer

❏ <package name>_node_modules - production dependencies in package '<package name>' [hash:<hash>]
including:
∙ hello-world
∙ random-quotes

building layer...
creating zip archive
<package root>/build/<package name>_node_modules.<hash>.zip - 72.5 kB

deploying layer...
done.

Deploying Functions

ƒ function1

building function...
creating zip archive
<package root>/build/function1.<hash>.zip - 291 B

creating new function...
done.
```

### npm script

Add below to `package.json`

```
"scripts": {
  "deploy:layer": "deployLayer",
  "deploy:all": "deployAll ./src",
},
```

Then you can run  
- `npm run deploy:layer` on CLI for deploying only layer
- `npm run deploy:all` on CLI for deploying functions binded to the layer

## Details

### Configuration

**package.json**
```js
{
  ...
  "aws": {
    "accessKeyId": { 
      "env": "ACCESS_KEY_ID" // get value from environment variable
    },
    "secretAccessKey": {
      "env": "SECRET_ACCESS_KEY" // get value from environment variable
    },
    "region": "eu-west-2" // or set value directly
  }
}
```

**lambda.json**  
Add `lambda.json` file in each function directory to set per function configuration.  
`Role` configuratoin is mandatory in order to deploy your function. So it must be set in this file or specified as a parameter when executing the command.

```js
{
  "Role": "arn:aws:iam::<Role_Arn_Id>", // this is mandatory
  "Description" : "My Awesome Function.",  // others are optional
  ...
}
```

default configurations for other properties are as below.  

```js
{
  FunctionName: <function_dir_name>,
  Handler: "index.handler",
  MemorySize: 256,
  Runtime: "nodejs12.x",
  Timeout: 15,
}
```

Find full configurable properties in [AWS javascript SDK's createFunction-property](    https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Lambda.html#createFunction-property)

**Optional `.env`**   
  ⚠️ Be careful not to push this file to any public repository.  
Overrides local environment variables.  
You can also set these values not in this file, but as environment variables.  

```
ACCESS_KEY_ID=<YOUR_ACCESS_KEY_ID>
SECRET_ACCESS_KEY=<YOUR_SECRET_ACCESS_KEY>
```


## Commands

- ### `deployLayer [--name=<layer_name>]`
  deploy `depencencies` of the package as a new layer version. (`devDependencies` are not be included)  
  If name param is not provided, it will be set to `${packageName}_node_modules`.  
  Checksum of `package.json` will be included to description of the layer. When you try to deploy it later, the library checks if `package.json` changed after the last deployment by comparing checksums.
  If `package.json` is not changed after last deploy, the layer will not be deployed to new version.  

  You can also add any local code to the layer. In order to do this, First, make it an 'npm package' by running `npm init` on the directory including the code. Then include it as dependency by running `npm i <path-to-the-package>`. see [Example](#Example).

- ### `deployFunction [--<ConfigKey>=<configValue>, ...] <path to function dir>`
	deploy directory as function. Here you can add or override configuraions over `lambda.json`. 
  
- ### `deployAll <path to parent dir of the functions>`
  deploy all subdirectories as functions having the layered depencencies of the package.


