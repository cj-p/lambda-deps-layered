const getProcessArgObject = () => process.argv
    .filter(arg => arg.startsWith('--'))
    .map(arg => arg.slice(2).split('='))
    .reduce((args, [key, value]) => Object.assign(args, {
        [key]: args[key] ? [].concat(args[key], value) : value
    }), {});

const jsonEquals = (obj1, obj2) => JSON.stringify(obj1) === JSON.stringify(obj2);

module.exports = {
    getProcessArgObject,
    jsonEquals
}
