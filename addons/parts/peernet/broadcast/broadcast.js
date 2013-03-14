var BroadcastPeerNetStack = Class({
    constructor: function (node) {
        this.node = node;
        this.expiration = node.host.settings["peernet.stack.broadcast.expiration"] || 3;
        this.ctx = node.context;
        this.ctx.revision = 0;
        this.ctx.state = { age: 0 };
        this.ctx.nodes = { };
    },
    
    receive: function (msg) {
        var method = 'on' + msg.data.cmd[0].toUpperCase() + msg.data.cmd.substr(1);
        if (typeof(this[method]) == 'function') {
            this[method].call(this, msg.data, msg.src.id);
        }
    },
    
    idle: function () {
        this.cleanupNodes();
        this.ctx.state.age ++;
        this.ctx.revision ++;
        this.stateUpdate();
    },
    
    cleanupNodes: function () {
        var deadNodes = [];
        for (var id in this.ctx.nodes) {
            var node = this.ctx.nodes[id];
            if (this.node.engine.iteration - node.updated > this.expiration) {
                deadNodes.push(id);
            }
        }
        deadNodes.forEach(function (id) {
            delete this.ctx.nodes[id];
        }, this);
    },
    
    stateUpdate: function () {
        this.node.broadcast({
            cmd: 'stateUpdate',
            ctx: this.ctx
        });        
    },
    
    onStateUpdate: function (msg, from) {
        this.ctx.nodes[from] = { state: msg.ctx.state, updated: this.node.engine.iteration };
        for (var id in msg.ctx.nodes) {
            if (id != this.node.id && !this.ctx.nodes[id]) {
                this.ctx.nodes[id] = msg.ctx.nodes[id];
            }
        }
    }
});

var BroadcastPeerNetStackAddon = Class({
    create: function (node) {
        return new BroadcastPeerNetStack(node);
    }
});

module.exports = new BroadcastPeerNetStackAddon();