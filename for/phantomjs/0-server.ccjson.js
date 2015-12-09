
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

                self.AspectInstance = function (aspectConfig) {

                    var config = {};
                    LIB._.merge(config, defaultConfig);
                    LIB._.merge(config, instanceConfig);
                    LIB._.merge(config, aspectConfig);
                    config = ccjson.attachDetachedFunctions(config);

                    var WebDriver = function () {
                        var self = this;
                        
                        var running = null;

                        function ensureInstalled () {
                            // TODO: Make version configurable.
                            return LIB.runbash([
                                'BO_ensureInSystemCache DOWNLOADED_PATH \\',
                                '    "bitbucket.org/ariya/phantomjs/downloads/phantomjs" \\',
                                '    "2.0.0" \\',
                                '    "https://bitbucket.org/ariya/phantomjs/downloads/phantomjs-2.0.0-macosx.zip"',
                                'echo "DOWNLOADED_PATH: $DOWNLOADED_PATH"',
                                // Now we check to make sure it runs
                                // @see https://github.com/ariya/phantomjs/issues/12900#issuecomment-85198514
                                'brew install upx || true',
                                'upx -d $DOWNLOADED_PATH/bin/phantomjs || true'
                            ], {
                                wrappers: {
                                    "bash.origin": true
                                },
                                exports: {
                                    "DOWNLOADED_PATH": true
                                }
                            }).then(function (result) {
                                return result.exports.DOWNLOADED_PATH;
                            });
                        }

                        function ensureStarted (basePath) {
                            if (running) {
                                return running;
                            }
                            return (running = LIB.runbash([
                                // @see https://github.com/ariya/phantomjs/issues/13165#issuecomment-157544910
                                basePath + '/bin/phantomjs --disk-cache=true --webdriver=4444'
                            ], {
                                verbose: LIB.VERBOSE,
                                wait: false
                            }).then(function (result) {

                                return new LIB.Promise(function (resolve, reject) {
                                    function waitUntilStarted () {
                                        LIB.request.get("http://127.0.0.1:4444/status", function (err, response) {
                                            if (err) {
                                                if (err.code === "ECONNREFUSED") {
                                                    return setTimeout(waitUntilStarted, 250);
                                                }
                                                return reject(err);
                                            }
                                            if (response.statusCode === 200) {
                                                return resolve();
                                            }
                                            // If we get any status other than 200 we try again.
                                            return setTimeout(waitUntilStarted, 250);
                                        });
                                    }
                                    return waitUntilStarted();
                                }).timeout(5 * 1000).catch(LIB.Promise.TimeoutError, function () {
                                    result.killDeep();
                                    throw new Error("Timeout connecting to phantomjs webdriver port 4444!");
                                }).then(function () {
                                    return result;
                                });
                            }));
                        }

                        self.start = function () {
                            return ensureInstalled().then(function (basePath) {
                                return ensureStarted(basePath);
                            }).then(function () {
                                return null;
                            });
                        }
                        self.stop = function () {
                            return LIB.Promise.try(function () {
                                if (!running) return;
                                return running.then(function (result) {
                                    running = null;
                                    return result.killDeep();
                                });
                            });
                        }
                    }

                    var webdriver = new WebDriver();

                    return LIB.Promise.resolve({
                        webdriver: function () {
                            return LIB.Promise.resolve(
                                ccjson.makeDetachedFunction(
                                    function () {
                                        return webdriver;
                                    }
                                )
                            );
                        }
                    });
                }
            }
            Entity.prototype.config = defaultConfig;

            return Entity;
        }
    });
}
