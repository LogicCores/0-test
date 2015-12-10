
exports.forLib = function (LIB) {
    var ccjson = this;

    return LIB.Promise.resolve({
        forConfig: function (defaultConfig) {

            var Entity = function (instanceConfig) {
                var self = this;

                var config = {};
                LIB._.merge(config, defaultConfig);
                LIB._.merge(config, instanceConfig);
                config = ccjson.attachDetachedFunctions(config);


                if (!LIB.fs.existsSync(config.testResultPath)) {
                    LIB.fs.mkdirsSync(config.testResultPath);
                }


                var testSuites = {}

                if (config.suites) {
                    function collectSuites (collection, configs) {
                        var traverse = LIB.traverse(configs);
                        traverse.forEach(function () {
                            var node = this;
                            // Detect test suite node
                            // TODO: Use a contract key (#<contract>) to detect test suite node and provided config format.
                            function hasSiblingProperty (name) {
                                var path = [].concat(node.path);
                                path.splice(path.length-1, 1, name);
                                return traverse.has(path);
                            }
                            if (
                                node.key === "label" &&
                                hasSiblingProperty("$alias") &&     // This assumes config is mapped in.
                                hasSiblingProperty("type") &&
                                hasSiblingProperty("implementation")
                            ) {
                                var key = [];
                                [
                                    "group",
                                    "label"
                                ].forEach(function (name) {
                                    if (typeof node.parent.node_[name] !== "undefined") {
                                        key.push(node.parent.node_[name]);
                                    }
                                });
                                key = key.join("/");
                                if (collection[key]) {
                                    throw new Error("Collection '" + key + "' already exists! Looks like it is declared multiple times!");
                                }
                                collection[key] = node.parent.node_;
                            }
                        });
                    }
                    if (config.suites) {
                        collectSuites(testSuites, config.suites);
                    }
                }

                var serverConfigPath = LIB.path.join(config.cachePath, "server.config.js");
                var runnerClientConfigPath = LIB.path.join(config.cachePath, "runner.client.config.js");

                function ensureRunnerConfig () {
                    // TODO: Allow overriding of config options.
                    var testConfig = {
                    	proxyPort: config.defaultConfig.proxyPort,
                    	proxyUrl: 'http://127.0.0.1:' + config.defaultConfig.proxyPort + '/',
                    	capabilities: {
                    		'selenium-version': '2.45.0'
                    	},
                    	environments: [
                    		{
                    			browserName: 'phantomjs'
                    		}
                    	],
                    	maxConcurrency: 3,
                    	reporters: [
                    	    'Console'
                    	],
                    	loaderOptions: {
                    		packages: [
                    //			{ name: 'todo', location: 'js' }
                    		]
                    	},
                    	suites: [
                    	],
                    	functionalSuites: [
                    	],
                    	excludeInstrumentation: "%%excludeInstrumentation%%"
                    };

                    var serverConfig = LIB._.cloneDeep(testConfig);
                    var runnerClientConfig = LIB._.cloneDeep(testConfig);
                    
                    serverConfig.reporters.push({
                        id: 'JUnit',
                        filename: LIB.path.join(config.testResultPath, 'server.report.xml')
                    });

                    runnerClientConfig.reporters.push({
                        id: 'JUnit',
                        filename: LIB.path.join(config.testResultPath, 'runner.client.report.xml')
                    });

                    // TODO: Write code coverage reports: http://theintern.github.io/intern/#reporter-lcov

                    Object.keys(testSuites).forEach(function (suiteId) {
                        var suiteConfig = testSuites[suiteId];
                        var propertyName = null;
                        if (suiteConfig.type === "unit") {
                            propertyName = "suites";
                        } else
                        if (suiteConfig.type === "functional") {
                            propertyName = "functionalSuites";
                            if (!suiteConfig.containers) {
                                suiteConfig.containers = {};
                            }
                            if (!suiteConfig.containers["browser"]) {
                                suiteConfig.containers["browser"] = true;
                            }
                        } else {
                            throw new Error("Unknown type '" + suiteConfig.type + "'!");
                        }
                        var relativeModulePath = null;
                        if (suiteConfig.implementation.internModulePath) {
                            relativeModulePath = LIB.path.relative(process.cwd(), suiteConfig.implementation.internModulePath).replace(/\.js$/, "");
                        } else
                        if (suiteConfig.implementation.modulePath) {
console.error("// TODO: Add paths to cache written test harnesses instead of directly to module.");
process.exit(1);
                        }
                        if (suiteConfig.containers["server"]) {
                            serverConfig[propertyName].push(relativeModulePath);
                        }
                        if (suiteConfig.containers["browser"]) {
                            runnerClientConfig[propertyName].push(relativeModulePath);
                        }
                    });

                    function writeConfig (path, testConfig) {
                        if (LIB.VERBOSE) console.log("Writing intern config file to '" + path + "'");
                        testConfig = "define(" + JSON.stringify(testConfig, null, 4) + ");";
                        // Fix some JS objects.
                        // TODO: Intern should allow pure JS and convert objects where needed itself.
                        testConfig = testConfig.replace(/"%%excludeInstrumentation%%"/, "/^tests\\/|bower_components\\/|node_modules\\/|\.cache\\//");
                        // TODO: Make this async.
                        LIB.fs.outputFileSync(path, testConfig, "utf8");
                    }

                    writeConfig(serverConfigPath, serverConfig);
                    writeConfig(runnerClientConfigPath, runnerClientConfig);
                }
                ensureRunnerConfig();


                var context = config.context();
                var api = {
                    run: function () {

                        var relativeInternPath = LIB.path.relative(process.cwd(), LIB.path.join(__dirname, "node_modules/intern"));
                        var relativeServerConfigPath = LIB.path.relative(process.cwd(), serverConfigPath);
                        var relativeRunnerClientConfigPath = LIB.path.relative(process.cwd(), runnerClientConfigPath);

                        if (LIB.VERBOSE) console.log("Running intern tests ...");

                        function runServerTests () {
                            if (LIB.VERBOSE) console.log("Running server tests using config '" + relativeServerConfigPath + "' ...");
                            return LIB.runbash([
                                'BO_run_node ' + relativeInternPath + '/client.js config=' + relativeServerConfigPath.replace(/\.js$/, "")
                            ], {
                                verbose: LIB.VERBOSE,
                                progress: true,
                                wrappers: {
                                    "bash.origin": true
                                }
                            });
                        }

                        function runClientTests () {

                            if (LIB.VERBOSE) console.log("Running client tests using config '" + relativeRunnerClientConfigPath + "' ...");

                            var serverdriver = config.serverdriver();
                            var webdriver = config.webdriver();

                            return serverdriver.start().then(function () {
                                return webdriver.start().then(function () {
                                    return LIB.runbash([
                                        'BO_run_node ' + relativeInternPath + '/runner.js config=' + relativeRunnerClientConfigPath.replace(/\.js$/, "")
                                    ], {
                                        verbose: LIB.VERBOSE,
                                        progress: true,
                                        wrappers: {
                                            "bash.origin": true
                                        }
                                    }).finally(function () {
                                        return webdriver.stop();
                                    });
                                }).finally(function () {
                                    return serverdriver.stop();
                                });
                            });
                        }

                        return runServerTests().then(function () {
                            return runClientTests();
                        }).then(function () {
                            if (LIB.VERBOSE) console.log("Done: Running intern based tests!");
                            return null;
                        }).catch(function (err) {
                            console.error("Error starting web driver:", err.stack);
                            throw err;
                        });
                    }
                };
                context.setAdapterAPI(api);


                self.AspectInstance = function (aspectConfig) {

                    var config = {};
                    LIB._.merge(config, defaultConfig);
                    LIB._.merge(config, instanceConfig);
                    LIB._.merge(config, aspectConfig);
                    config = ccjson.attachDetachedFunctions(config);

                    return LIB.Promise.resolve({
                        app: function () {

                            return LIB.Promise.resolve(
                                ccjson.makeDetachedFunction(
                                    function (req, res, next) {
                            
                                        var params = req.params;
                                        if (config.match) {
                                            // TODO: Relocate into generic helper.
                                            var expression = new RegExp(config.match.replace(/\//g, "\\/"));
                                            var m = expression.exec(req.params[0]);
                                            if (!m) return next();
                                            params = m.slice(1);
                                        }
                            
                                        var uri = params[0];

                                        var m = uri.match(/^intern\.config\/([^\/]+)\/([^\/]+)\.js$/);
                                        if (m) {
                                            var suiteConfig = testSuites[m[1] + "/" + m[2]];
                                            if (suiteConfig) {

                                                // TODO: Write this config above and cache it as well?
                                                var internConfig = {
                                                	reporters: [
                                                	    'Console',
                                                	    'Html'
                                                	],
                                                	loaderOptions: {
                                                		packages: []
                                                	},
                                                	suites: []
                                                };

                                                var relativeModulePath = null;
                                                if (suiteConfig.implementation.internModulePath) {
                                                    relativeModulePath = LIB.path.relative(process.cwd(), suiteConfig.implementation.internModulePath).replace(/\.js$/, "");
                                                } else
                                                if (suiteConfig.implementation.modulePath) {
                        console.error("// TODO: Add paths to cache written test harnesses instead of directly to module.");
                        process.exit(1);
                                                }
                                                internConfig.suites.push("internapi/" + relativeModulePath);

                                                res.writeHead(200, {
                                                    "Content-Type": "application/javascript"
                                                });
                                                res.end('define(' + JSON.stringify(internConfig, null, 4) + ');');
                                                return;
                                            }
                                            res.writeHead(404);
                                            res.end("Not Found");
                                            return;
                                        } else
                                        if (/^intern\//.test(uri)) {
                                            return LIB.send(req, uri, {
                                        		root: LIB.path.join(__dirname, "node_modules"),
                                        		maxAge: config.clientCacheTTL || 0
                                        	}).on("error", next).pipe(res);
                                        }

                                        return LIB.send(req, uri, {
                                    		root: LIB.path.join(__dirname, "../../../.."),
                                    		maxAge: config.clientCacheTTL || 0
                                    	}).on("error", next).pipe(res);
                                    }
                                )
                            );
                        },
                        getJobModulePath: function () {
                            return LIB.path.join(__dirname, "job.js");
                        }
                    });
                }
            }
            Entity.prototype.config = defaultConfig;

            return Entity;
        }
    });
}
