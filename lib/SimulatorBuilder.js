var async   = require("async"),
    events  = require("events"),
    u       = require("./utils");

var Simulator = Class(events.EventEmitter, {
    constructor: function () {
        this.settings = {};
        this.reporter = null;
    },
    
    get requires () {
        return {
            engine: { name: "engine", space: "engines" }
        };        
    },
    
    simulate: function (done) {
        var engine;
        try {
            engine = this.engine.create();
        } catch (err) {
            done(err);
            return this;
        }
        this.emit("start", this, engine);
        var self = this;
        engine.simulate(function (err) {
            self.emit("end", self, err);
            process.nextTick(function () {
                done(err);
            });
        });
        return this;
    },
    
    report: function (object) {
        this.emit("report", object);
        if (typeof(this.reporter) == 'function') {
            this.reporter(object);
        }
        return this;
    }
});

var SimulatorBuilder = Class({
    constructor: function (addonResolver) {
        this.addonResolver = addonResolver;
        this.reset();
    },
    
    reset: function () {
        this.simulator = new Simulator();
        this.stack = [this.simulator];
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
                                loadedAddon.register(self.simulator);
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