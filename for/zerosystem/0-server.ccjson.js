
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

                    var ServerDriver = function () {
                        var self = this;
                        
                        var running = null;

                        function ensureStarted (basePath) {
                            if (running) {
                                return running;
                            }
                            return (running = LIB.runbash([
// TODO: Run in dev or production mode depending on how our job is being run.
                                'npm run dev'
                            ], {
                                verbose: LIB.VERBOSE,
                                wait: false
                            }).then(function (result) {

                                return new LIB.Promise(function (resolve, reject) {
                                    function waitUntilStarted () {
                                        if (LIB.VERBOSE) console.log("Check status:", "http://127.0.0.1:8090/.status");
                                        LIB.request.get("http://127.0.0.1:8090/.status", function (err, response) {
                                            if (err) {
                                                if (err.code === "ECONNREFUSED") {
                                                    return setTimeout(waitUntilStarted, 250);
                                                }
                                                return reject(err);
                                            }
                                            if (response.headers["x-server-booted"] === "1") {
                                                return resolve();
                                            }
                                            // If we get any status other than 200 we try again.
                                            return setTimeout(waitUntilStarted, 250);
                                        });
                                    }
                                    return waitUntilStarted();
                                }).timeout(15 * 1000).catch(LIB.Promise.TimeoutError, function () {
                                    return result.killDeep().then(function () {
                                        throw new Error("Timeout connecting to zerosystem!");
                                    });
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

                    var serverdriver = new ServerDriver();

                    return LIB.Promise.resolve({
                        serverdriver: function () {
                            return LIB.Promise.resolve(
                                ccjson.makeDetachedFunction(
                                    function () {
                                        return serverdriver;
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
