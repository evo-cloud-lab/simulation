var LoopPeerNetStack = Class({
    constructor: function (node) {
        this.node = node;
        this.cfg = {
            ticks: node.host.settings["peernet.stack.loop.ticks"],
            expiration: node.host.settings["peernet.stack.loop.expiration"] || 300
        };
        if (!this.cfg.ticks) {
            this.cfg.ticks = Math.floor(this.cfg.expiration / 2);
        }
        this.ctx = node.context;
        this.ctx.lastUpdate = -1;
        this.ctx.nodes = {};
    },
    
    receive: function (msg) {
        var method = 'on' + msg.data.cmd[0].toUpperCase() + msg.data.cmd.substr(1);
        if (typeof(this[method]) == 'function') {
            this[method].call(this, msg.data, msg.src.id);
        }
    },
    
    tick: function () {
        var nodesCount = Object.keys(this.ctx.nodes).length;
        this.cleanupNodes();
        
        if (nodesCount > 0 && Object.keys(this.ctx.nodes).length == 0) {
            this.ctx.lastUpdate = -1;
        }
        
        if (this.ctx.lastUpdate < 0 ||
            this.currentTick() - this.ctx.lastUpdate > this.cfg.ticks) {
            this.sendUpdate();
        }
    },
    
    currentTick: function () {
        return this.node.engine.tick;
    },
    
    updated: function () {
        this.node.engine.updated = true;
    },
    
    cleanupNodes: function () {
        var deadNodes = [];
        for (var id in this.ctx.nodes) {
            if (this.currentTick() - this.ctx.nodes[id].updated > this.cfg.expiration) {
                deadNodes.push(id);
            }
        }
        if (deadNodes.length > 0) {
            this.updated();
            deadNodes.forEach(function (id) {
                delete this.ctx.nodes[id];
            }, this);
            this.findNext();
        }
    },

    sendUpdate: function () {
        if (Object.keys(this.ctx.nodes).length == 0) {
            this.node.broadcast({ cmd: "join", age: this.currentTick() });
        } else {
            this.node.unicast(this.makeState(), this.ctx.next);
        }
        this.ctx.lastUpdate = this.currentTick();
        this.updated();
    },
    
    makeState: function () {
        var nodes = { };
        nodes[this.node.id] = this.currentTick();
        for (var id in this.ctx.nodes) {
            nodes[id] = this.ctx.nodes[id].updated;
        }
        return { cmd: "state", nodes: nodes };
    },
    
    findNext: function () {
        var next;
        var ids = Object.keys(this.ctx.nodes)
                        .map(function (id) { return parseInt(id); })
                        .sort();
        if (ids.length > 0) {
            if (!ids.some(function (id) {
                    if (id > parseInt(this.node.id)) {
                        next = id;
                        return true;
                    }
                    return false;
                }.bind(this))) {
                next = ids[0];
            }
        }
        if (next != this.ctx.next) {
            if (next == undefined) {
                delete this.ctx.next;
            } else {
                this.ctx.next = next;
            }
            this.updated();
        }
    },
    
    onJoin: function (msg, from) {
        if (!this.ctx.nodes[from] ||
            this.ctx.nodes[from].updated != msg.age ) {
            this.ctx.nodes[from] = { updated: msg.age };
            this.findNext();
            this.sendUpdate();
        }
        this.node.unicast(this.makeState(), from);
    },
    
    onState: function (msg, from) {
        var updated = false;
        for (var id in msg.nodes) {
            if (id == this.node.id) {
                continue;
            }
            if (!this.ctx.nodes[id] ||
                this.ctx.nodes[id].updated < msg.nodes[id]) {
                this.ctx.nodes[id] = { updated: msg.nodes[id] };
                updated = true;
            }
        }
        if (updated) {
            this.findNext();
            this.sendUpdate();
        }
    }
});

var LoopPeerNetStackAddon = Class({
    create: function (node) {
        return new LoopPeerNetStack(node);
    }
});

module.exports = new LoopPeerNetStackAddon();