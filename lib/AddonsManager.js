var fs    = require("fs"),
    path  = require("path"),
    async = require("async"),
    yaml  = require("js-yaml"),
    u = require("./utils");

function listComponents(prefix, ext, fn) {
    var dir = path.normalize(path.join(__dirname, "..", prefix));
    async.waterfall([
        function (next) {
            fs.stat(dir, next);
        },
        function (stat, next) {
            if (stat.isDirectory()) {
                fs.readdir(dir, next);
            } else {
                next(null, []);
            }
        },
        function (files, next) {
            async.filter(files, function (file, next) {
                if (file.match(new RegExp("\\." + ext + "$"))) {
                    fs.stat(path.join(dir, file), function (err, stat) {
                        next(!err && stat.isFile());
                    });
                } else {
                    next(false);
                }
            }, function (files) {
                next(null, files.map(function (file) { return path.basename(file, "." + ext); }));
            });
        }
    ], fn);
}

function listAddons(space, fn) {
    listComponents(path.join("addons", space), "js", fn);
}

function listConfs(space, addonName, fn) {
    listComponents(path.join("conf", space, addonName), "yml", fn);
}

function loadAddon(space, addonName) {
    return require(path.join("..", "addons", space, addonName));
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
                listConfs(req.space, name, function (err, confs) {
                    next(null, err ? [] : confs);
                });
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
