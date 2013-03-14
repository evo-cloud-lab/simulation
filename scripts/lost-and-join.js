var State = Class({
    constructor: function (inspector) {
        this.inspector = inspector;
    },
    
    iterationStart: function () {
        return this;
    },
    
    iterationDone: function () {
        return this;
    },
    
    report: function (state) {
        this.inspector.addState(state);
        this.inspector.host.report({ inspector: state });
    }
});

var JoiningState = Class(State, {
    constructor: function (inspector, nextState) {
        State.prototype.constructor.call(this, inspector);
        this.nextState = nextState;
    },
    
    iterationDone: function (engine, iteration) {
        if (engine.nodes.every(function (node) {
                var ids = Object.keys(node.context.nodes);
                if (ids.length != engine.nodes.length - 1) {
                    return false;
                }
                return ids.every(function (id) {
                    return node.context.nodes[id].state.age == engine.nodes[id - 1].context.state.age;
                });
            })) {
            this.report({ joined: iteration });
            return this.nextState.call(this);
        }
        return this;
    }
});

var BLOCK_ID = "1";

var BreakingState = Class(State, {
    constructor: function (inspector) {
        State.prototype.constructor.call(this, inspector);
        this.blocking = false;
    },
    
    iterationStart: function (engine, iteration) {
        if (!this.blocking) {
            engine.block(BLOCK_ID, true);
            this.blocking = true;
            this.report({ breaking: iteration });
        }
        return this;
    },
    
    iterationDone: function (engine, iteration) {
        if (engine.nodes.every(function (node) {
                if (node.id == BLOCK_ID) {
                    return true;
                }
                return Object.keys(node.context.nodes).indexOf(BLOCK_ID) < 0;
            })) {
            this.report({ lost: iteration });
            engine.block(BLOCK_ID, false);
            this.blocking = false;
            this.report({ rejoining: iteration });
            return new JoiningState(this.inspector, function () { return new FinalState(this.inspector); });
        }
        return this;
    }
});

var FinalState = Class(State, {
    constructor: function (inspector) {
        State.prototype.constructor.call(this, inspector);
        this.report('final');
    }
});

var Inspector = Class({
    constructor: function (host) {
        this.host = host;
        this.state = new JoiningState(this, function () { return new BreakingState(this.inspector); });
        this.states = [];
        var self = this;
        host.on("peernet.iteration.start", function () {
                    self.iterationStart.apply(self, arguments);
                })
            .on("peernet.iteration.done", function () {
                    self.iterationDone.apply(self, arguments);
                })
            .on("end", function () {
                    self.summary();
                });
    },
    
    addState: function (state) {
        this.states.push(state);
    },
    
    iterationStart: function (engine, iteration) {
        this.state = this.state.iterationStart(engine, iteration);
    },
    
    iterationDone: function (engine, iteration) {
        this.state = this.state.iterationDone(engine, iteration);        
    },
    
    summary: function () {
        this.host.report({ inspector: this.states });
    }
});

module.exports = function (host) {
    new Inspector(host);
};