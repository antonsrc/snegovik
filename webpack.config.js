const path = require('path');

module.exports = {
    entry: './src/main.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'public'),
    },
    performance: {
        hints: false,
        maxAssetSize: 1048576,
    }
};
