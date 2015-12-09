
exports.forLib = function (LIB) {
    return {
        forContext: function (context) {
            return {
                main: function (config) {

                    return context.adapters[config.adapter].run();
                }
            };
        }
    }
}
