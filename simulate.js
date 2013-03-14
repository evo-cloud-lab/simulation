var fs        	= require("fs"),
	path		= require("path"),
    async     	= require("async"),
    yaml		= require("js-yaml"),
    clc 		= require("cli-color"),
    nom 		= require("nomnom"),
    commander 	= require("commander"),
    u 			= require("./lib/utils");

global.Class = u.Class;

var SimulatorBuilder = require("./lib/SimulatorBuilder"),
    AddonsManager    = require("./lib/AddonsManager");

var _noColor = {
    quot: function (s) { return '"' + s + '"'; },
    note: function (s) { return '(' + s + ')'; },
    info: function (s) { return s; },
    warn: function (s) { return s; },
    err: function (s) { return s; },
    fatal: function (s) { return s; },
};

var _ansiColor = {
    quot: function (s) { return clc.bold(s); },
    note: function (s) { return clc.italic.underline(s); },
    info: function (s) { return clc.green(s); },
    warn: function (s) { return clc.yellow(s); },
    err: function (s) { return clc.red(s); },
    fatal: function (s) { return clc.red.bold(s); },
};

var opts = nom.script("simulate")
	      .option("config", {
                abbr: "c",
                metavar: "FILE",
                list: true,
                help: "Read configurations from FILE"
            }).option("define", {
                abbr: "d",
                metavar: "KEY:JSON",
                list: true,
                help: "Set configuration, if JSON starts with @, value is loaded from filename followed"
            }).option("resolve", {
                abbr: "r",
                metavar: "REQUIRE:ADDON",
                list: true,
                help: "Select the resolution for specified requirement"
            }).option("script", {
                flag: true,
                help: "Don't display in color"
            }).option("output", {
                abbr: "o",
                metavar: "FILE",
                help: "Specify output for report instead of stdout"
            }).option("append", {
                abbr: "a",
                help: "Append to output file instead of overwrite"
            }).parse();

var t = opts.script ? _noColor : _ansiColor;

var CliChooser = Class({
    constructor: function (opts) {
        this.nonInteractive = opts.script;
        this.resolves = {};
        if (Array.isArray(opts.resolve)) {
            opts.resolve.forEach(function (value) {
                var mapper = value.split(":");
                if (mapper.length == 2 && mapper[0] && mapper[1]) {
                    this.resolves[mapper[0]] = mapper[1];
                }
            }, this);
        }
    },
    
    choose: function (type, options, info, done) {
        this["_choose" + type[0].toUpperCase() + type.substr(1)].apply(this, [].slice.call(arguments, 1));
    },
    
    _chooseAddon: function (options, info, done) {
        var reqFull = info.req.space + '#' + info.key;
        var resolvedName = this.resolves[reqFull];
        if (resolvedName && options.indexOf(resolvedName) >= 0) {
            console.log("Use addon " + t.quot(resolvedName) + " for " + t.quot(info.req.name) + " " + t.note(reqFull));
            done(null, resolvedName);
        } else {
            if (resolvedName) {
                console.log(t.warn("Resolution " + t.quot(resolvedName) + " not found for " + t.note(reqFull)));
            }
            if (resolvedName && this.nonInteractive) {
                done(new Error("Resolution " + resolvedName + " not found for " + reqFull));
            } else if (options.length > 1) {
                if (this.nonInteractive) {
                    done(new Error("Multiple options for " + t.quot(info.req.name) + " " + t.note(reqFull) + ", use --no-script or specify --resolve"));
                } else {
                    console.log("Addon for " + t.quot(info.req.name) + " " + t.note(reqFull) + ":");
                    commander.choose(options, function (index) {
                        done(null, options[index]);
                    });
                }
            } else if (options.length == 1) {
                console.log("Use addon " + t.quot(options[0]) + " for " + t.quot(info.req.name) + " " + t.note(reqFull));
                done(null, options[0]);
            } else {
                done(new Error('No available addon for "' + info.req.name + '" (' + reqFull + ')'));
            }
        }        
    },
    
    _chooseConf: function (options, info, done) {
        if (options.length > 1) {
            console.log("Configuration:");
            commander.choose(options, function (index) {
                done(null, options[index]);
            });
        } else if (options.length == 1) {
            console.log("Use configuration " + t.quot(options[0]));
            done(null, options[0]);
        } else {
            done(new Error('No available addon for "' + info.req.name + '"'));
        }        
    }
});

function formatReport(object) {
    return "---\n" + yaml.dump(object, { indent: 4 }) + "\n";
}

function simulate(simulator) {
	// load configurations
    if (Array.isArray(opts.config)) {
        opts.config.forEach(function (conffile) {
            var conf;
            try {
                conf = yaml.load(fs.readSync(conffile, { encoding: 'utf8' }));
            } catch (err) {
                console.log(t.warn(err));
            }
            if (conf) {
                Object.keys(conf).forEach(function (key) {
                    simulator.settings[key] = conf[key];
                });
            }
        });
    }
    
	// update configurations
    if (Array.isArray(opts.define)) {
        opts.define.forEach(function (definition) {
            var index = definition.indexOf(":");
            if (index > 0) {
				var key = definition.substr(0, index);
				var val = definition.substr(index + 1);
				if (val[0] == '@') {
					val = fs.readSync(val.substr(1), { encoding: 'utf8' });
				}
                simulator.settings[key] = JSON.parse(val);
            }
        });
    }
    
	// truncate output log file
    if (opts.output && !opts.append && fs.existsSync(opts.output)) {
        fs.closeSync(fs.openSync(opts.output, "w"));
    }

	// hook-up reporter
    simulator.reporter = opts.output ? function (object) { fs.appendFileSync(opts.output, formatReport(object)); }
                                     : function (object) {
                                        console.log(formatReport(object));
                                    };

	// load scripts
	if (Array.isArray(opts._)) {
		opts._.forEach(function (script) {
			console.log("Loading " + script);
			var fullpath = path.resolve(script);
			require(fullpath)(simulator);
		});
	}
	
	simulator.on("start", function () {
	    console.log(t.info("Simulation START"));
	}).on("end", function () {
		console.log(t.info("Simulation END"));
	}).simulate(function (err) {
		if (err) {
			console.log(t.fatal(err));
		}
		process.nextTick(function () {
			process.exit(err ? 1 : 0);
		});
    });                    
}

new SimulatorBuilder(new AddonsManager.Resolver(new CliChooser(opts)))
    .build(function (err, simulator) {
        if (err) {
            console.log(t.fatal(err));
            process.exit(1);
        } else {
            simulate(simulator);
        }
    });
