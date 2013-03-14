var async = require("async"),
    u = require("./utils");

var SimulatorBuilder = new Class({
    initialize: function (addonResolver) {
        this.addonResolver = addonResolver;
        this.reset();
    },
    
    reset: function () {
        this.stack = [
            Object.create({
                get requires () {
                    return {
                        engine: { name: "engine", space: "engines" }
                    };
                },
                
                settings: {},
                
                simulate: function (done) {
                    try {
                        this.engine.create().simulate(done);
                    } catch (err) {
                        done(err);
                    }
                },
                
                report: function (object) {
                    if (typeof(this.reporter) == 'function') {
                        this.reporter(object);
                    }
                }
            })
        ];
        this.processed = 0;
    },
    
    build: function (done) {
        var self = this;
        async.whilst(
            function () { return self.processed < self.stack.length; },
            function (next) {
                var addon = self.stack[self.processed];
                var reqs = addon.requires || {};
                async.forEach(Object.keys(reqs),
                    function (property, next) {
                        self.addonResolver.resolve(reqs[property], property, u.ok(next, function (loadedAddon) {
                            addon[property] = loadedAddon;
                            self.stack.push(loadedAddon);
                            if (typeof(loadedAddon.register) == 'function') {
                                loadedAddon.register(self.stack[0]);
                            }
                            next();
                        }));
                    },
                    u.ok(next, function () {
                        self.processed ++;
                        next();
                    })
                );
            },
            function (err) {
                done(err, self.stack[0]);
            }
        );
    }
});

module.exports = SimulatorBuilder;
