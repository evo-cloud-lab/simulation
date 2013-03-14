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

exports.whenOk = function (res, status, callback) {
    if (typeof(status) == 'function') {
        callback = status;
        status = 500;
    }
    return function () {
        var err = arguments[0];
        if (err) {
            res.json(status, err);
        } else {
            var args = [].slice.call(arguments, 1);
            callback.apply(res, args);
        }        
    }
};