var GroupedPeerNetStack = Class({
    constructor: function (node) {
        this.node = node;
        this.ctx = node.context;
        this.ctx.nodes = {};
    },

    receive: function (msg) {
    },
    
    idle: function () {
    }
});

var GroupedPeerNetStackAddon = Class({
    create: function (node) {
        return new GroupedPeerNetStack(node);
    }
});

module.exports = new GroupedPeerNetStackAddon();