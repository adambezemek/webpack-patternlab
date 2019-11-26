// webpack.config.js
const webpack = require('webpack');
const { resolve } = require('path');
const globby = require('globby');
const { getIfUtils, removeEmpty } = require('webpack-config-utils');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const EventHooksPlugin = require('event-hooks-webpack-plugin');
const plConfig = require('./patternlab-config.json');
const patternlab = require('patternlab-node')(plConfig);
const patternEngines = require('patternlab-node/core/lib/pattern_engines');
const merge = require('webpack-merge');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const FixStyleOnlyEntriesPlugin = require('webpack-fix-style-only-entries');
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const rimraf = require('rimraf');
const BrowserSyncPlugin = require('browser-sync-webpack-plugin');
const bs = require('browser-sync').create();

module.exports = env => {
    const { ifProduction, ifDevelopment } = getIfUtils(env);

    const config = merge.smartStrategy(plConfig.app.webpackMerge)({
        devtool: ifDevelopment('source-map'),
        context: resolve(__dirname, plConfig.paths.source.root),
        node: {
            fs: 'empty',
        },
        entry: {
            'js/app': globby
                .sync([
                    resolve(__dirname, `${plConfig.paths.source.js}**/*.js`),
                    '!**/*.test.js',
                ])
                .map(function(filePath) {
                    return filePath;
                }),
            'css/app': globby
                .sync([
                    resolve(
                        __dirname,
                        `${plConfig.paths.source.scss}**/style.scss`
                    ),
                ])
                .map(function(filePath) {
                    return filePath;
                }),
        },
        output: {
            path: resolve(__dirname, plConfig.paths.public.root),
            filename: '[name].js',
        },
        optimization: {
            minimizer: [
                new UglifyJsPlugin(plConfig.app.uglify),
                new OptimizeCssAssetsPlugin({}),
            ],
            splitChunks: {
                cacheGroups: {
                    vendor: {
                        test: /node_modules/,
                        chunks: 'initial',
                        name: 'js/vendor',
                        priority: 10,
                        enforce: true,
                    },
                },
            },
        },
        plugins: removeEmpty([
            ifDevelopment(
                new webpack.HotModuleReplacementPlugin(),
                new webpack.NamedModulesPlugin()
            ),
            // Remove with PL Core 3.x
            new CopyWebpackPlugin([
                {
                    // Copy all images from source to public
                    context: resolve(plConfig.paths.source.images),
                    from: './**/*.*',
                    to: resolve(plConfig.paths.public.images),
                },
                {
                    // Copy favicon from source to public
                    context: resolve(plConfig.paths.source.root),
                    from: './*.ico',
                    to: resolve(plConfig.paths.public.root),
                },
                {
                    // Copy all web fonts from source to public
                    context: resolve(plConfig.paths.source.fonts),
                    from: './*',
                    to: resolve(plConfig.paths.public.fonts),
                },
                {
                    // Copy all css from source to public
                    context: resolve(plConfig.paths.source.css),
                    from: './*.css',
                    to: resolve(plConfig.paths.public.css),
                },
                {
                    // Styleguide Copy everything but css
                    context: resolve(plConfig.paths.source.styleguide),
                    from: './**/*',
                    to: resolve(plConfig.paths.public.root),
                    ignore: ['*.css'],
                },
                {
                    // Styleguide Copy and flatten css
                    context: resolve(plConfig.paths.source.styleguide),
                    from: './**/*.css',
                    to: resolve(plConfig.paths.public.styleguide, 'css'),
                    flatten: true,
                },
            ]),
            ifDevelopment(
                new EventHooksPlugin({
                    afterEmit: function(compilation) {
                        const supportedTemplateExtensions = patternEngines.getSupportedFileExtensions();
                        const templateFilePaths = supportedTemplateExtensions.map(
                            function(dotExtension) {
                                return `${plConfig.paths.source.patterns}**/*${dotExtension}`;
                            }
                        );

                        // additional watch files
                        const watchFiles = [
                            `${plConfig.paths.source.patterns}**/*.(json|md|yaml|yml)`,
                            `${plConfig.paths.source.data}**/*.(json|md|yaml|yml)`,
                            `${plConfig.paths.source.fonts}**/*`,
                            `${plConfig.paths.source.images}**/*`,
                            `${plConfig.paths.source.meta}**/*`,
                            `${plConfig.paths.source.annotations}**/*`,
                        ];

                        const allWatchFiles = watchFiles.concat(
                            templateFilePaths
                        );

                        allWatchFiles.forEach(function(globPath) {
                            const patternFiles = globby
                                .sync(globPath)
                                .map(function(filePath) {
                                    return resolve(__dirname, filePath);
                                });
                            patternFiles.forEach(item => {
                                compilation.fileDependencies.add(item);
                            });
                        });
                    },
                    thisCompilation: () => {
                        let cleanPublic = plConfig.cleanPublic;
                        process.argv.forEach((val, index) => {
                            if (val.includes('cleanPublic')) {
                                val = val.split('=');
                                cleanPublic = JSON.parse(val[1]);
                            }
                        });

                        rimraf('public', [], () => {
                            console.log(
                                '\x1b[36m',
                                '### Public Folder Cleaned ###',
                                '\x1b[0m'
                            );
                            setTimeout(function() {
                                patternlab.build(() => {
                                    console.log(
                                        '\x1b[36m',
                                        '### Patternlab Rebuild Complete ###',
                                        '\x1b[0m'
                                    );
                                }, cleanPublic);
                            });
                        });
                    },
                    done: () => {
                        console.log(
                            '\x1b[36m',
                            '### Reload Browser ###',
                            '\x1b[0m'
                        );

                        bs.reload();
                    },
                })
            ),
            new BrowserSyncPlugin({
                port: plConfig.app.webpackDevServer.port,
            }),
            new FixStyleOnlyEntriesPlugin(),
            new MiniCssExtractPlugin({
                filename: '[name].css',
            }),
            new OptimizeCssAssetsPlugin({
                assetNameRegExp: /\.app\.css$/g,
                cssProcessor: require('cssnano'),
                cssProcessorPluginOptions: {
                    preset: [
                        'default',
                        { discardComments: { removeAll: true } },
                    ],
                },
                canPrint: true,
            }),
        ]),
        devServer: {
            contentBase: resolve(__dirname, plConfig.paths.public.root),
            publicPath: `${plConfig.app.webpackDevServer.url}:${plConfig.app.webpackDevServer.port}`,
            port: plConfig.app.webpackDevServer.port,
            open: true,
            hot: false,
            watchContentBase: plConfig.app.webpackDevServer.watchContentBase,
            watchOptions: plConfig.app.webpackDevServer.watchOptions,
        },
        module: {
            rules: [
                {
                    enforce: 'pre',
                    test: /\.js$/,
                    exclude: /(node_modules|bower_components)/,
                    loader: 'eslint-loader',
                },
                {
                    test: /\.js$/,
                    exclude: /(node_modules|bower_components)/,
                    use: [
                        {
                            loader: 'babel-loader',
                            options: {
                                cacheDirectory: true,
                            },
                        },
                    ],
                },
                {
                    test: /\.(sa|sc|c)ss$/,
                    use: [
                        {
                            loader: MiniCssExtractPlugin.loader,
                            options: {
                                hmr: process.env.NODE_ENV === 'development',
                                reloadAll: true,
                            },
                        },
                        'css-loader',
                        'postcss-loader',
                        'sass-loader',
                    ],
                },
                {
                    test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
                    use: [
                        {
                            loader: 'file-loader',
                            options: {
                                name: '[name].[ext]',
                                outputPath: 'fonts/',
                            },
                        },
                    ],
                },
            ],
        },
    });

    return config;
};
