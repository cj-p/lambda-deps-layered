const getArgumentsObject = () => process.argv
    .filter(arg => arg.startsWith('--'))
    .map(arg => arg.slice(2).split('='))
    .reduce((args, [key, value]) => Object.assign(args, {
        [key]: args[key] ? [].concat(args[key], value) : value
    }), {});

module.exports = {
    getProcessArgObject: getArgumentsObject
}
