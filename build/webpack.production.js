'use strict';
const merge = require('webpack-merge');
const common = require('./webpack.base.js');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = merge.multiple(common, [
  {
    mode: "none",
    output: {
      filename: `millionbounce.min.js`
    },
    optimization: {
      minimize: false
    },
    devtool: '#source-map',
    plugins: [
      new TerserPlugin({
        sourceMap: true,
        parallel: true,
      }),
      new webpack.LoaderOptionsPlugin({
        minimize: true
      })
    ]
  }]);

