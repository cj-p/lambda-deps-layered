const getProcessArgObject = () => process.argv
    .filter(arg => arg.startsWith('--'))
    .map(arg => arg.slice(2).split('='))
    .reduce((args, [key, value]) => Object.assign(args, {
        [key]: args[key] ? [].concat(args[key], value) : value
    }), {});

const jsonEquals = (obj1, obj2) => JSON.stringify(obj1) === JSON.stringify(obj2);

const distinct = arr => Array.from(arr.reduce((set, item) => {
    set.add(item)
    return set;
}, new Set()));

const extract = (...keys) => obj => keys.reduce((result, key) => ({
    ...result,
    [key]: obj[key],
}), {})

const mapExtract = mapping => obj => Object.entries(mapping).reduce((result, [key, targetKey]) => ({
    ...result,
    [key]: obj[targetKey],
}), {})

const requireOnly = (arr, err = new TypeError('This array should have only 1 elements.')) => {
    if (arr.length === 1) return arr[0]
    throw err
}

module.exports = {
    getProcessArgObject,
    jsonEquals,
    distinct,
    extract,
    mapExtract,
    requireOnly
}
