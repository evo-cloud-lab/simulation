var BroadcastPeerNetStack = Class({
    constructor: function (node) {
        this.node = node;
        this.expiration = node.host.settings["peernet.stack.broadcast.expiration"] || 300;
        this.ctx = node.context;
        this.ctx.lastUpdate = -1;
        this.ctx.nodes = { };
    },
    
    receive: function (msg) {
        var method = 'on' + msg.data.cmd[0].toUpperCase() + msg.data.cmd.substr(1);
        if (typeof(this[method]) == 'function') {
            this[method].call(this, msg.data, msg.src.id);
        }
    },
    
    tick: function () {
        this.cleanupNodes();
        if (this.ctx.lastUpdate < 0 ||
            this.currentTick() - this.ctx.lastUpdate > this.expiration / 2) {
            this.stateUpdate();
            this.ctx.lastUpdate = this.currentTick();
            this.updated();
        }
    },
    
    currentTick: function () {
        return this.node.engine.iteration;
    },
    
    updated: function () {
        this.node.engine.updated = true;
    },
    
    cleanupNodes: function () {
        var deadNodes = [];
        for (var id in this.ctx.nodes) {
            var node = this.ctx.nodes[id];
            if (this.currentTick() - node.updated > this.expiration) {
                deadNodes.push(id);
            }
        }
        if (deadNodes.length > 0) {
            this.updated();
        }
        deadNodes.forEach(function (id) {
            delete this.ctx.nodes[id];
        }, this);
    },
    
    stateUpdate: function () {
        var nodes = { };
        for (var id in this.ctx.nodes) {
            nodes[id] = this.ctx.nodes[id].updated;
        }
        this.node.broadcast({
            cmd: 'stateUpdate',
            nodes: nodes
        });        
    },
    
    onStateUpdate: function (msg, from) {
        for (var id in msg.nodes) {
            if (id != this.node.id &&
                (!this.ctx.nodes[id] || this.ctx.nodes[id].updated < msg.nodes[id])) {
                this.ctx.nodes[id] = { updated: msg.nodes[id] };
                this.updated();
            }
        }
        if (!this.ctx.nodes[from] ||
            this.ctx.nodes[from].updated != this.currentTick()) {            
            this.ctx.nodes[from] = { updated: this.currentTick() };
            this.updated();
        }
    }
});

var BroadcastPeerNetStackAddon = Class({
    create: function (node) {
        return new BroadcastPeerNetStack(node);
    }
});

module.exports = new BroadcastPeerNetStackAddon();