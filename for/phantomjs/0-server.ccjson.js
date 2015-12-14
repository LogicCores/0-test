
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

                        function ensureStarted () {
                            if (running) {
                                return running;
                            }
                            return (running = LIB.runbash([
                                // @see https://github.com/ariya/phantomjs/issues/13165#issuecomment-157544910
                                // TODO: Path to plugin 'bash.origin.phantomjs' should resolve automatically instead of providing absolute path.
                                'BO_callPlugin "' + LIB.path.join(__dirname, "../../../../lib/bash.origin.phantomjs/bash.origin.phantomjs") + '" run --disk-cache=true --webdriver=4444'
                            ], {
                                wrappers: {
                                    "bash.origin": true
                                },
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
                                }).timeout(30 * 1000).catch(LIB.Promise.TimeoutError, function () {
                                    result.killDeep();
                                    throw new Error("Timeout connecting to phantomjs webdriver port 4444 (30 sec)!");
                                }).then(function () {
                                    return result;
                                });
                            }));
                        }

                        self.start = function () {
                            return ensureStarted().then(function () {
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
