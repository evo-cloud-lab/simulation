var GroupedPeerNetStack = new Class({
    initialize: function (node) {
        this.node = node;
    },
    
    run: function (done) {
        done();
    }
});

var GroupedPeerNetStackAddon = new Class({
    create: function (node) {
        return new GroupedPeerNetStack(node);
    }
});

module.exports = new GroupedPeerNetStackAddon();