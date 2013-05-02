var _ = require("underscore");

function error(message) {
    return new Error("[peernet] " + message);
}

var MessageEvent = Class({
    constructor: function (type, msg, src, dst) {
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

var PeerNetNode = Class({
    constructor: function (id, engine) {
        this.id = id;
        this.engine = engine;
        this.context = { };
        this.groups = { };
        this.queue = [ ];
        this.stack = engine.addon.stack.create(this);
    },
    
    get host () {
        return this.engine.addon.host;
    },
    
    tick: function () {
        this.stack.tick();
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
    
    unicast: function (msg, dest) {
        this.engine.unicast(new MessageEvent('u', msg, this, dest));
        return this;
    },
    
    multicast: function (msg, group) {
        this.engine.multicast(new MessageEvent('m', msg, this, group));
        return this;
    }
});

var Options = Class({
    constructor: function (options) {
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
    
    optional: function (name, defVal) {
        name = "peernet." + name;
        var val = this.options[name];
        return val == undefined ? defVal : val;
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

var PeerNetEngine = Class({
    constructor: function (addon) {
        this.addon = addon;
        
        var opts = new Options(addon.host.settings);
        var nodeCount = opts.positive("nodes");
        this.ticks = opts.positive("ticks");
        this.msgrate = opts.optional("msgrate", 25);

        this.tick = 0;
        this.counters = { messages: 0, traffic: 0 }
        this.nodes = [];
        for (var i = 0; i < nodeCount; i ++) {
            this.nodes[i] = new PeerNetNode((i + 1).toString(), this);
        }
        this.blocked = {};
    },

    block: function (id, blocked) {
        if (blocked) {
            this.blocked[id] = blocked;
        } else {
            delete this.blocked[id];
        }
        return this;
    },
    
    deliver: function (dst, event) {
        this.counters.traffic ++;
        if (!this.blocked[dst.id]) {
            dst.enqueue(event.dup());
        }
        return this;
    },
    
    broadcast: function (event) {
        if (!this.blocked[event.src.id]) {
            this.nodes.forEach(function (node) {
                if (node.id != event.src.id) {
                    this.deliver(node, event);
                }
            }, this);
            this.counters.messages ++;
        }
        return this;
    },
    
    unicast: function (event) {
        if (!this.blocked[event.src.id]) {
            var id = parseInt(event.dst);
            if (id > 0 && id <= this.nodes.length) {
                event.dst = this.nodes[id - 1];
                this.deliver(event.dst, event);
                this.counters.messages ++;
            }
        }
        return this;
    },
    
    multicast: function (event) {
        if (!this.blocked[event.src.id]) {
            this.nodes.forEach(function (node) {
                if (node.id != msg.src.id && node.groups[group]) {
                    this.deliver(node, event);
                }
            }, this);
            this.counters.messages ++;
        }
        return this;
    },

    report: function () {
        var summary = {
            tick: this.tick,
            counters: this.counters,
            nodes: {}
        };
        this.nodes.forEach(function (node) {
            summary.nodes[node.id] = {
                context: node.context
            }
        }, this);
        this.addon.host.report({ peernet: summary });
    },
    
    simulate: function (done) {
        for(this.tick = 0; this.tick < this.ticks; ) {
            this.counters = { messages: 0, traffic: 0 };
            this.updated = false;
            this.addon.host.emit("peernet.tick.start", this, this.tick);
            for (var msgCount = 0; msgCount < this.msgrate; ) {
                var idleCount = 0;
                this.iterate(function (node) {
                    if (msgCount < this.msgrate) {
                        var msg = node.queue.shift();
                        if (msg) {
                            msg.dispatch(node);
                            msgCount ++;
                        } else {
                            idleCount ++;
                        }
                    }
                });
                if (idleCount >= Object.keys(this.nodes).length) {
                    break;
                }
            }
            this.iterate(function (node) {
                node.tick();
            });
            this.addon.host.emit("peernet.tick.done", this, this.tick);
            if (this.updated) {
                this.report();
            }
            this.tick ++;
        }
        done();
    },
    
    iterate: function (fn) {
        _.shuffle(Object.keys(this.nodes)).forEach(function (id) {
            fn.call(this, this.nodes[parseInt(id)]);
        }, this);
    }
});

var PeerNetEngineAddon = Class({    
    get requires () {
        return {
            stack: { name: "peernet.stack", space: "peernet" }
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