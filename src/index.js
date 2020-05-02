module.exports = {
    AWS: require('./awsConfig').AWS,
    config: require('./awsConfig').config,
    deployRole: require('./deployRole'),
    deployLayer: require('./deployLayer'),
    deployFunction: require('./deployFunction'),
    deployGateway: require('./deployGateway')
}
