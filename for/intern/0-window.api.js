
exports.forLib = function (LIB) {
    
    var exports = {};

    exports.spin = function (context) {
    
        var Test = function () {
            var self = this;

            self.getDevGitCommitTag = function () {
                return context.config.devGitCommitTag;
            }

            self.getDevGitDirty = function () {
                return context.config.devGitDirty;
            }

            self.getRunBrowserTestsUrlForSuite = function (suite) {
                var url = context.config.runBrowserTestsUrl;
                url = url.replace(/{group}/, suite.group);
                // TODO: Use 'name' here instead of 'label'.
                url = url.replace(/{label}/, suite.label);
                if (/^\//.test(url)) {
                    url = window.location.protocol + "//" + window.location.host + url;
                }
                return url;
            }
        }

        return new Test(context);
    }

    return exports;
}
