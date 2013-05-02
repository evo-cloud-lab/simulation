var State = Class({
    constructor: function (inspector) {
        this.inspector = inspector;
    },
    
    tickStart: function () {
        return this;
    },
    
    tickDone: function () {
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
    
    tickDone: function (engine, tick) {
        if (engine.nodes.every(function (node) {
                return Object.keys(node.context.nodes).length == engine.nodes.length - 1;
            })) {
            engine.updated = true;
            this.report({ joined: tick });
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
    
    tickStart: function (engine, tick) {
        if (!this.blocking) {
            engine.block(BLOCK_ID, true);
            this.blocking = true;
            engine.updated = true;
            this.report({ breaking: tick });
        }
        return this;
    },
    
    tickDone: function (engine, tick) {
        if (engine.nodes.every(function (node) {
                if (node.id == BLOCK_ID) {
                    return true;
                }
                return Object.keys(node.context.nodes).indexOf(BLOCK_ID) < 0;
            })) {
            engine.updated = true;
            this.report({ lost: tick });
            engine.block(BLOCK_ID, false);
            this.blocking = false;
            this.report({ rejoining: tick });
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
        host.on("peernet.tick.start", function () {
                    self.tickStart.apply(self, arguments);
                })
            .on("peernet.tick.done", function () {
                    self.tickDone.apply(self, arguments);
                })
            .on("end", function () {
                    self.summary();
                });
    },
    
    addState: function (state) {
        this.states.push(state);
    },
    
    tickStart: function (engine, tick) {
        this.state = this.state.tickStart(engine, tick);
    },
    
    tickDone: function (engine, tick) {
        this.state = this.state.tickDone(engine, tick);        
    },
    
    summary: function () {
        this.host.report({ inspector: this.states });
    }
});

module.exports = function (host) {
    new Inspector(host);
};