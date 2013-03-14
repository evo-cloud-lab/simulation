var fs    = require("fs"),
    path  = require("path"),
    async = require("async"),
    yaml  = require("js-yaml"),
    u = require("./utils");

function listAddons(space, fn) {
    var dir = path.normalize(path.join(__dirname, "..", "addons", space));
    fs.stat(dir, function (err, stat) {
        if (!err && stat.isDirectory()) {
            fs.readdir(dir, u.ok(fn, function (files) {
                async.filter(files, function (file, next) {
                    fs.stat(path.join(dir, file, file + ".js"), function (err, stat) {
                        next(!err && stat.isFile());
                    });
                }, function (files) {
                    fn(null, files.map(function (file) {
                        return path.basename(file, ".js");
                    }));
                });
            }));
        } else {
            fn(null, []);
        }
    });
}

function listConfs(space, addonName, fn) {
    var dir = path.normalize(path.join(__dirname, "..", "conf", space, addonName));
    fs.stat(dir, function (err, stat) {
        if (!err && stat.isDirectory()) {
            fs.readdir(dir, u.ok(fn, function (files) {
                async.filter(files, function (file, next) {
                    if (file.match(/\.yml$/)) {
                        fs.stat(path.join(dir, file), function (err, stat) {
                            next(!err && stat.isFile());
                        });
                    } else {
                        next(false);
                    }
                }, function (files) {
                    fn(null, files.map(function (file) {
                        return path.basename(file, ".yml");
                    }));
                });
            }));
        } else {
            fn(null, []);
        }
    });
}

function loadAddon(space, addonName) {
    return require(path.join("..", "addons", space, addonName, addonName));
}

function loadConf(space, addonName, confName, fn) {
    var filename = path.join(__dirname, "..", "conf", space, addonName, confName + ".yml");
    fs.readFile(filename, u.ok(fn, function (data) {
        var err = null, doc;
        try {
            doc = yaml.load(data.toString());
        } catch (e) {
            err = e;
        }
        fn(err, doc);
    }));
}

function configureAddon(addon, conf, done) {
    if (typeof(addon.configure) == 'function') {
        try {
            addon.configure(conf, done);
        } catch (err) {
            done(err);
        }
    } else {
        done();
    }
}

var Resolver = Class({
    constructor: function (chooser) {
        this.chooser = chooser;
    },
    
    resolve: function (req, key, done) {
        var self = this;
        var addonName, addon;
        async.waterfall([
            function (next) {
                listAddons(req.space, next);
            },
            function (names, next) {
                self.chooser.choose("addon", names, { req: req, key: key }, next);
            },
            function (name, next) {
                addonName = name;
                addon = loadAddon(req.space, name);
                listConfs(req.space, name, next);
            },
            function (confs, next) {
                if (confs.length >= 1) {
                    async.waterfall([
                        function (next) {
                            self.chooser.choose("conf", confs, {
                                    name: addonName,
                                    req: req,
                                    addon: addon
                                },
                                next
                            );
                        },
                        function (conf, next) {
                            loadConf(req.space, addonName, conf, next);
                        },
                        function (confData, next) {
                            configureAddon(addon, confData, next);
                        }
                    ], next);
                } else {
                    configureAddon(addon, undefined, next);
                }
            }
        ], function (err) {
            done(err, addon);
        });
    }
});

module.exports = {
    listAddons: listAddons,
    listConfs: listConfs,
    loadAddon: loadAddon,
    loadConf: loadConf,
    configureAddon: configureAddon,
    Resolver: Resolver
};
