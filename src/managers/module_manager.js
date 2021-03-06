var fs = require('fs-promise'),
    Path = require('path'),
    loadPackageMeta = require('read-package-json'),
    logger = require('../utils/logger')('ModuleLoader');

/**
 * Represents an object capable of loading and handling modules.
 * @constructor
 */
var ModuleManager = function() {
    this.basePath = Path.resolve(Path.join(__dirname, '..', '..', 'bot_modules'));
    this.modules = {};
    this.help = {};
    global.requireBaseModule = global.requireBaseModule || function() {
        return require(Path.resolve(__dirname, '..', 'base_module.js'));
    }
};

/**
 * Preloads module metadata from the modules pool
 * @param  {String} path Module path to be loaded
 * @return {Promise}      Promise that will be always resolved, but will have a falsey value
 *                        if a problem is found during the load process.
 * @since 2.0.0
 * @static
 */
ModuleManager.preloadModule = function(path) {
    const packageFile = Path.join(path, 'package.json');
    const name = Path.basename(path);
    return fs.stat(packageFile)
        .then(s => {
            return new Promise((resolve) => {
                loadPackageMeta(packageFile, (err, packageMeta) => {
                    if(err) {
                        logger.warning(`INVALID: Module ${name} has an invalid package.json file.`);
                        resolve(null);
                    } else {
                        resolve({
                            meta: {
                                version: packageMeta.version,
                                root: path,
                                rootName: name,
                                entrypoint: Path.join(path, packageMeta.main),
                                author: packageMeta.author,
                                contributors: packageMeta.contributors,
                                moduleName: packageMeta.giskard.module,
                                created: packageMeta.giskard.created,
                                help: packageMeta.giskard.help,
                                dependencies: packageMeta.dependencies,
                                description: packageMeta.description
                            },
                            instance: null
                        });
                    }
                });
            });
        })
        .catch(ex => {
            if(ex.code === 'ENOENT' && ex.path.endsWith('package.json')) {
                logger.warning(`INVALID: Module ${name} lacks a package.json file.`);
            } else {
                logger.error('Unexpected Error: ');
                logger.error(ex);
            }
            return null;
        });
}

ModuleManager.prototype = {
    preloadModule: ModuleManager.preloadModule,

    /**
     * Gets the path for the given module
     * @param  {String} name Module name
     * @return {String}      Path to the module with the given name
     */
    pathForModuleNamed: function(name) {
        return Path.join(this.basePath, name);
    },

    /**
     * Reads the modules directory and returns all possible loadable JavaScript files.
     * @return {String[]}       A list of possibly loadable JavaScript modules.
     */
    getModules: function() {
        const loaderResult = fs.readdirSync(this.basePath)
            .map(f => {
                try {
                    var path = this.pathForModuleNamed(f),
                        stat = fs.statSync(path);
                    if(stat.isDirectory()) {
                        return ModuleManager.preloadModule(path);
                    } else {
                        return Promise.resolve(null);
                    }
                } catch(ex) {
                    logger.error(ex);
                    return Promise.resolve(null);
                }
            });
        return Promise.all(loaderResult);
    },

    /**
     * Loads all possible modules, ignoring failed ones.
     * Also parses module's documentations and fills metadata required by any subsystem.
     * @return {Promise}          A Promise that will be resolved whenever all modules have been loaded
     *                            or failed to load. The resulting list will contain all modules
     *                            constructors.
     */
    loadModules: function() {
        logger.info('Loading modules...');

        return this.getModules()
            .then(mods => {
                mods
                    .filter(m => !!m)
                    .forEach(m => this.loadModule(m));
            })
            .catch(ex => {
                logger.error(ex);
            })
    },

    /**
     * Loads a single module into the system
     * @param  {Object} mod Module metadata
     * @return {Boolean}     True if the module was successfully loaded, otherwise, false.
     * @since  2.0.0
     */
    loadModule: function(mod) {
         try {
            const Ctor = require(mod.meta.entrypoint);
            Ctor.prototype._meta = mod.meta;
            mod.instance = new Ctor();
            logger.info(`Loaded module: ${mod.meta.moduleName}@${mod.meta.version}`);
            this.modules[mod.meta.rootName] = mod;
            this.help[mod.meta.rootName] = { title: mod.meta.moduleName, contents: {} };
            Object.keys(mod.meta.help)
                .forEach(k => this.help[mod.meta.rootName].contents[k] = mod.meta.help[k]);
            return true;
        } catch(ex) {
            logger.error(`Error loading ${mod.meta.moduleName}@${mod.meta.version}:`);
            logger.error(ex);
            this.modules[mod.meta.rootName] = { failed: true, meta: mod.meta }
            return false;
        }
    },

    /**
     * Completely unloads a given module by its name
     * @param  {String} name Module name to be unloaded
     * @return {undefined}      Nothing
     * @since 2.0
     */
    unloadModule: function(name) {
        var mod = this.modules[name];
        if(!mod) {
            logger.warning(`Attempt to unload unknown module ${name}`);
            return;
        }
        logger.info(`${name}: Unloading...`);
        var basePath = mod.meta.root;
        if(!!mod.instance) {
            logger.info(`${name}: Imploding module instance...`);
            mod.instance.implode();
        }
        logger.info(`${name}: Removing require cache...`);
        Object.keys(require.cache)
            .filter(k => k.startsWith(basePath))
            .forEach(k => {
                logger.debug(`${name}: Unloading ${k}`)
                delete require.cache[k];
            });
    }
};

module.exports = ModuleManager;
