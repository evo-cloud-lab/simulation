exports.ok = function (next, fn) {
    return function () {
        var err = arguments[0];
        if (err) {
            next.apply(this, arguments);
        } else {
            fn.apply(this, [].slice.call(arguments, 1));
        }
    };
};

exports.Class = function (base, proto) {
    if (typeof(base) != 'function') {
        proto = base;
        base = Object;
    }
    if (!proto) {
        proto = {};
    }
    proto.__proto__ = base.prototype;
    var theClass = function () {
        if (typeof(this.constructor) == 'function') {
            this.constructor.apply(this, arguments);
        }
    };
    theClass.prototype = proto;
    return theClass;
};