var async = require("async"),
    _ = require("underscore");

function error(message) {
    return new Error("[peernet] " + message);
}

var RouteError = new Class({
    Extends: Error,
    initialize: function (dest) {
        this.parent("Route not available: " + dest);
        this.destination = dest;
    }
});

var MessageEvent = new Class({
    initialize: function (type, msg, src, dst) {
        this.type = type;
        this.data = msg;
        this.src = src;
        this.dst = dst;
    },
    
    dup: function () {
        return new MessageEvent(this.type, _.clone(this.data), this.src, this.dst);
    },
    
    dispatch: function (node) {
        node.stack.receive(this);
    }
});

var PeerNetNode = new Class({
    initialize: function (id, engine) {
        this.id = id;
        this.engine = engine;
        this.context = { };
        this.groups = { };
        this.queue = [ ];
        this.stack = engine.addon.stack.create(this);
    },
    
    run: function (done) {
        var self = this;
        var len = this.queue.length;
        async.forEach(this.queue.slice(0, len),
            function (event, next) { 
                event.dispatch(self);
                next();
            },
            function (err) {
                self.queue.splice(0, len);
                self.stack.idle();
                done(err);
            }
        );
    },
    
    enqueue: function (event) {
        this.queue.push(event);
    },

    join: function (group) {
        this.groups[group] = true;
        return this;
    },
    
    leave: function (group) {
        delete this.groups[group];
        return this;
    },
    
    broadcast: function (msg) {
        this.engine.broadcast(new MessageEvent('b', msg, this));
        return this;
    },
    
    unicast: function (msg, dest, callback) {
        this.engine.unicast(new MessageEvent('u', msg, this, dest), callback);
        return this;
    },
    
    multicast: function (msg, group) {
        this.engine.multicast(new MessageEvent('m', msg, this, group));
        return this;
    }
});

var Options = new Class({
    initialize: function (options) {
        this.options = options;
    },

    required: function (name) {
        name = "peernet." + name;
        var val = this.options[name];
        if (val == null || val == undefined) {
            throw error("undefined: " + name);
        }
        return val;
    },
    
    positive: function (name) {
        var val = this.required(name);
        val = parseInt(val);
        if (val <= 0) {
            throw error("invalid: peernet." + name + " = " + val);
        }
        return val;
    }
});

var PeerNetEngine = new Class({
    initialize: function (addon) {
        this.addon = addon;
        
        var opts = new Options(addon.host.settings);
        var nodeCount = opts.positive("nodes");
        this.iterations = opts.positive("iterations");

        this.iteration = 0;
        this.counters = { messages: 0, traffic: 0 }
        this.nodes = [];
        for (var i = 0; i < nodeCount; i ++) {
            this.nodes[i] = new PeerNetNode(i + 1, this);
        }
    },

    deliver: function (dst, event) {
        this.counters.traffic ++;
        dst.enqueue(event.dup());
    },
    
    broadcast: function (event) {
        this.nodes.forEach(function (node) {
            if (node.id != event.src.id) {
                this.deliver(node, event);
            }
        }, this);
        this.counters.messages ++;
        return this;
    },
    
    unicast: function (event, callback) {
        var id = parseInt(event.dst);
        if (id > 0 && id <= this.nodes.length) {
            event.dst = this.nodes[id - 1];
            this.deliver(event.dst, event);
            this.counters.messages ++;
            process.nextTick(callback);
        } else {
            process.nextTick(function () {
                callback(new RouteError(event.dst));
            });
        }
        return this;
    },
    
    multicast: function (event) {
        this.nodes.forEach(function (node) {
            if (node.id != msg.src.id && node.groups[group]) {
                this.deliver(node, event);
            }
        }, this);
        this.counters.messages ++;
        return this;
    },

    report: function () {
        var summary = {
            iteration: this.iteration,
            counters: this.counters,
            nodes: {}
        };
        this.nodes.forEach(function (node) {
            summary.nodes[node.id] = {
                context: node.context
            }
        }, this);
        this.addon.host.report(summary);
    },
    
    simulate: function (done) {
        this.iteration = 0;
        var self = this;
        async.whilst(
            function () { return self.iteration < self.iterations; },
            function (next) {
                self.counters = { messages: 0, traffic: 0 };
                var ids = _.shuffle(Object.keys(self.nodes));
                async.parallel(
                    ids.map(function (idStr) {
                        return function (done) {
                            self.nodes[parseInt(idStr)].run(done);
                        };
                    }),
                    function (err) {
                        self.report();
                        self.iteration ++;
                        next(err);
                    }
                );
            },
            done
        );
    }
});

var PeerNetEngineAddon = new Class({    
    get requires () {
        return {
            stack: { name: "peernet.stack", space: "parts/peernet" }
        };
    },
    
    register: function (host) {
        this.host = host;
    },
    
    create: function () {
        return new PeerNetEngine(this);
    }
});

module.exports = new PeerNetEngineAddon();
