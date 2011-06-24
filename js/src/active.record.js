/*!
 * ActiveRecord v1.2
 *
 * Copyright (c) 2011 Philipp Boes
 * https://github.com/phillies2k/ActiveRecord/
 * 
 * Licensed under the GPL License.
 *
 * Includes MD5 (Message-Digest Algorithm)
 * http://www.webtoolkit.info/
 *
 */

(function(){
    'use strict';
    
    var H = {};
    
    if (!Object.prototype.watch) {
        
        Object.prototype.watch = function (prop, handler) {
            
            var oldval = this[prop], newval = oldval,
                getter = function () {
                    return newval;
                },
                setter = function (val) {
                    oldval = newval;
                    return (newval = handler.call(this, prop, oldval, val));
                };
            
            if (delete this[prop]) { // can't watch constants
                if (Object.defineProperty) // ECMAScript 5
                    Object.defineProperty(this, prop, {
                        get: getter,
                        set: setter
                    });
                else if (Object.prototype.__defineGetter__ && Object.prototype.__defineSetter__) { // legacy
                    Object.prototype.__defineGetter__.call(this, prop, getter);
                    Object.prototype.__defineSetter__.call(this, prop, setter);
                }
            }
        };
    }
    
    if (!Object.prototype.unwatch) {
        
        Object.prototype.unwatch = function (prop) {
            
            var val = this[prop];
            delete this[prop]; // remove accessors
            this[prop] = val;
        };
    }
    
    Object.prototype.__defineGetter__('__uuid__', (function(){
        H.gid = 0;
        return function() {
            var id = H.gid++;
            this.__proto__ = {
                __proto__: this.__proto__,
                get __uuid__() { return id; },
                set __uuid__() {}
            }
            return id;
        }
    })());
    
    Object.prototype.toString = function() {
        return '[object #' + this.__uuid__ + ']';
    }
    
    function serialize(obj) {
        var s = [], p,
            add = function( k, v ) {
                v = typeof v == 'function' ? v() : v;
                s[ s.length ] = encodeURIComponent(k) + '=' + encodeURIComponent(v);
            },
            buildParams = function( prefix, o ) {
                if (typeof o == 'object') {
                    for (var n in o) {
                        buildParams(prefix + '[' + n + ']', o[n])
                    }
                } else {
                    add(prefix, o);
                }
            };
        
        for (p in obj) {
            buildParams(p, obj[p]);
        }
        
        return s.join( "&" ).replace( /%20/g, "+" );
    }
    
    function extend() {
        
        var t = arguments[0] || this, len = arguments.length,
            i = 1, src, g, s, p;
        
        for ( ; i < len; i++ ) {
            
            src = arguments[i];
            
            for (p in src) {
                g = src.__lookupGetter__(p);
                s = src.__lookupSetter__(p);
                
                if (g || s) {
                    if (g) t.__defineGetter__(p, g);
                    if (s) t.__defineSetter__(p, s);
                } else {
                    t[p] = src[p];
                }
            }
        }
        
        return t;
    }
    
    function obj_hash( obj ) {
        return MD5(serialize(obj));
    }
    
    window.$storage = window.localStorage = localStorage;
    window.ActiveRecord = window.$db = ActiveRecord = {
        
        Version: '1.2',
        
        SORT_ASC:   'asc',
        SORT_DESC:  'desc',
        
        BELONGS_TO:                 1,
        BELONGS_TO_AND_HAS_MANY:    2,
        HAS_MANY:                   3,
        HAS_ONE:                    4,
        
        SYNC_ONE_WAY: 0,
        SYNC_TWO_WAY: 1,
        
        settings: {
            syncUrl: null,
            syncMode: 0,
            sync: false,
            method: 'GET',
            user: null,
            pass: null,
            params: null
        },
        
        Storage: function() {
            return new ActiveRecord.Storage.fn.init();
        },
        
        DB: function( db ) {
            return new ActiveRecord.DB.fn.init(db);
        },
        
        Model: function( type, schemata, db ) {
            return new ActiveRecord.Model.fn.init(type, schemata, db);
        },
        
        init: function( db, options ) {
            
            options = options || {};
            options = extend({}, this.settings, options);
            
            return new ActiveRecord.fn.init(db, options);
        }
    }
    
    ActiveRecord.Storage.fn = ActiveRecord.Storage.prototype = {
        constructor: ActiveRecord.Storage,
        
        storage: null,
        
        init: function() {
            this.storage = {};
        },
        
        attach: function( obj ) {
            if (!this.has(obj)) {
                this.storage[ obj_hash(obj) ] = obj;
            }
        },
        
        detach: function( obj ) {
            if (this.has(obj)) {
                delete this.storage[ obj_hash(obj) ];
            }
        },
        
        has: function( obj ) {
            return !!this.storage[ obj_hash(obj) ];
        },
        
        toObject: function() {
            var obj = this.storage;
            delete obj.__uuid__;
            delete obj.__proto__.__uuid__;
            return obj;
        }
    };
    
    ActiveRecord.Storage.fn.init.prototype = ActiveRecord.Storage.fn;
    
    ActiveRecord.fn = ActiveRecord.prototype = {
        constructor: ActiveRecord,
        
        settings: null,
        
        activeObjects: 0,
        
        init: function( db, options ) {
            
            this.settings = options;
            this.db = new ActiveRecord.DB(db);
            
            var self = this;
            H.watch('gid', function(prop, oldVal, newVal){
                self.activeObjects = newVal;
                return newVal;
            });
            
            return this;
        },
        
        getUUIDFromObject: function( obj ) {
            return obj_hash(obj);
        },
        
        get: function( type ) {
            return this.db.get(type);
        },
        
        getAll: function() {
            return this.db.getAll();
        },
        
        has: function( type )  {
            return this.db.has(type);
        },
        
        clear: function( type ) {
            return this.db.clear(type);
        },
        
        destroy: function( type ) {
            return this.db.destroy(type);
        },
        
        create: function( type, schemata ) {
            return this.db.create(type, schemata);
        },
        
        persist: function( model ) {
            return this.db.persist(model);
        },
        
        persistAll: function() {
            return this.db.persistAll();
        },
        
        sync: function( mode ) {
            if (this.synchronizing) return;
            
            mode = mode || this.settings.syncMode;
            
            try {
                
                this.synchronizing = true;
                
                var options = {
                    url: this.settings.syncUrl,
                    method: this.settings.method.toUpperCase(),
                    contentType: this.settings.method == 'post' ? this.settings.contentType || 'application/x-www-form-urlencoded' : null,
                    encoding: this.settings.encoding || null,
                    params: this.settings.params || {}
                };
                
                var xhr = new XMLHttpRequest();
                xhr.open(options.method, options.url, true);
                
                var name, headers = {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-ActiveRecord-Version': ActiveRecord.Version,
                    'Accept': 'text/javascript, text/html, application/xml, text/xml, */*'
                };
                
                if (options.method == 'POST') {
                    headers['Content-Type'] = options.contentType + (options.encoding ? '; charset=' + options.encoding : '');
                }
                
                for (name in headers) {
                    xhr.setRequestHeader(name, headers[name]);
                }
                
                xhr.onreadystatechange = function() {
                    
                    if (xhr.readyState == 4) {
                        
                        if (xhr.getResponseHeader('Content-Type').indexOf('application/json') === 0) {
                            eval('xhr.responseJSON = ' + xhr.responseText);
                        }
                    }
                }
                
                options.params.data = {};
                var type, repo, all = this.getAll();
                
                for (type in all) {
                    repo = all[ type ];
                    options.params.data[ type ] = [
                        repo.getSchemata(),
                        repo.getRelations(),
                        this.settings.syncRecords ? repo.findAll() : null
                    ];
                    
                }
                
                xhr.send(options.method == 'POST' ? serialize(options.params) : null);
                
            } catch (e) {
                
                throw new Error(e);
                
            } finally {
                
                this.synchronizing = false;
            }
        }
    }
    ActiveRecord.fn.init.prototype = ActiveRecord.fn;
    
    ActiveRecord.DB.fn = ActiveRecord.DB.prototype = {
        constructor: ActiveRecord.DB,
        
        repositories: null,
        
        storage: '',
        
        init: function( db ) {
            
            this.repositories = {};
            this.storage = db;
            
            return this;
        },
        
        clear: function( type ) {
            
            var model = this.get(type);
            
            this.repositories[ type ].removedObjects.storage =
            this.repositories[ type ].addedObjects.storage = {};
            
            $storage.setItem( this.storage + '.' + type, JSON.stringify([
                model.getSchemata(),
                model.getRelations(),
                {}
            ]));
        },
        
        destroy: function( type ) {
            delete this.repositories[ type ];
            $storage.removeItem(this.storage + '.' + type);
        },
        
        has: function( type ) {
            return !!$storage.getItem( this.storage + '.' + type );
        },
        
        create: function( type, schemata ) {
            
            if (this.has(type)) {
                throw new Error('a model of that type already exists in this storage.');
            }
            
            var model = new ActiveRecord.Model(type, schemata, this);
            this.repositories[ type ] = model;
            
            return this.repositories[ type ];
        },
        
        getAll: function() {
            var p, raw, results = {}, type;
            for (p in $storage) {
                if (p.indexOf(this.storage + '.') === 0) {
                    type = p.substr(this.storage.length+1);
                    results[type] = this.get(type);
                }
            }
            return results;
        },
        
        get: function( type ) {
            
            if (this.has(type)) {
                
                if (!this.repositories[ type ]) {
                    var raw = JSON.parse($storage.getItem( this.storage + '.' + type )),
                        model = new ActiveRecord.Model(type, raw[0], this), uuid;
                    model.relations = raw[1];
                    
                    for (uuid in raw[2]) {
                        model.add(raw[2][uuid]);
                    }
                    
                    this.repositories[ type ] = model;
                }
                
                return this.repositories[ type ];
            }
            
            return false;
        },
        
        persist: function( model ) {
            
            var added = model.addedObjects.toObject(),
                removed = model.removedObjects.toObject(),
                repo = this.storage + '.' + model.type,
                uuid , dump = $storage.getItem(repo), n;
            
            dump = dump ? JSON.parse(dump) : [ model.getSchemata(), model.getRelations(), {} ];
            
            for (uuid in added) {
                for (n in added[uuid]) {
                    if (n in model.ignoredProperties) {
                        delete added[uuid][n];
                    }
                }
                
                dump[2][uuid] = added[uuid];
            }
            
            for (uuid in removed) {
                if (dump[2][uuid]) {
                    delete dump[2][uuid];
                }
            }
            
            $storage.setItem(repo, JSON.stringify(dump));
            return true;
        },
        
        persistAll: function() {
            for (var type in this.repositories) {
                this.persist(this.repositories[type]);
            }
        }
    }
    ActiveRecord.DB.fn.init.prototype = ActiveRecord.DB.fn;
    
    ActiveRecord.Model.fn = ActiveRecord.Model.prototype = {
        constructor: ActiveRecord.Model,
        
        ignoredProperties: {
            __uuid__: true
        },
        
        magicProperties: {
            __belongsTo: true,
            __belongsToAndHasMany: true,
            __hasMany: true,
            __hasOne: true
        },
        
        db: null,
        
        validation: true,
        
        addedObjects: null,
        
        removedObjects: null,
        
        schemata: {},
        
        relations: {},
        
        type: false,
        
        init: function( type, schemata, db ) {
            
            if (typeof db != 'object' && !db instanceof ActiveRecord.DB) {
                throw new Error('db must be an instance of ActiveRecord.DB. instance of ' + (typeof db) + 'given.');
            }
            
            if (typeof type !== 'string') {
                throw new Error('type must be of type string.');
            }
            
            if (typeof schemata != 'object') {
                throw new Error('invalid model schemata given.');
            }
            
            this.type = type.toLowerCase();
            this.db = db;
            
            for (var prop in schemata) {
                if (prop in this.ignoredProperties) continue;
                else if (prop in this.magicProperties) {
                    this.relations[prop] = schemata[prop].split(/\s*,\s*/);
                    continue;
                }
                
                this.schemata[prop] = schemata[prop];
            }
            
            this.addedObjects = new ActiveRecord.Storage;
            this.removedObjects = new ActiveRecord.Storage;
            
            return this;
        },
        
        findByUUID: function( uuid ) {
            
            if (typeof this.addedObjects.storage[ uuid ] != 'undefined') {
                return this.addedObjects.storage[ uuid ];
            }
            
            return false;
        },
        
        findOne: function() {
            var all = this.findAll(), p;
            for (p in all) break;
            return all[p];
        },
        
        findOneBy: function( prop, val, op ) {
            return this.findAllBy(prop, val, op, 0, 1);
        },
        
        findAllBy: function( prop, val, op, offset, limit ) {
            offset = offset || 0;
            
            op = op || 'equals';
            
            var records = this.addedObjects.storage,
                uuid, record, results = { length: 0 },
                modelType, self = this,
                add_record = function() {
                    if (results.length >= offset && (!limit || limit && results.length < limit)) {
                        results[uuid] = record;
                        ++results.length;
                    }
                },
                auto_wire_relations = function() {
                    var rel, i, mtype, model, res = {}, curr;
                    for (rel in self.relations) {
                        switch (rel) {
                            case '__belongsTo':
                            case '__hasOne':
                            case '__belongsToAndHasMany':
                            case '__hasMany':
                                
                                for ( i=0 ; i < self.relations[rel].length; i++) {
                                    
                                    mtype = self.relations[rel][i].toLowerCase();
                                    
                                    if (self.db.has(mtype)) {
                                        
                                        if (res[mtype]) {
                                            throw new Error('a property with that name already exists');
                                        }
                                        
                                        res[mtype] = {};
                                        
                                        model = self.db.get(mtype);
                                        
                                        curr = model.findAllBy(prop, val, op, offset, limit);
                                        if (curr.length) {
                                            res[mtype] = curr;
                                        }
                                    }
                                }
                                break;
                        }
                    }
                    return res;
                };
            
            if (prop.indexOf('.') > 0) {
                var b = prop.split('.');
                modelType = b[0];
                prop = b[1];
                
                var props = auto_wire_relations();
            }
            
            for (uuid in records) {
                
                record = records[ uuid ];
                
                if (modelType && modelType.length) {
                    //record = _extend(record, props);
                } else if (typeof record[prop] != 'undefined') {
                    
                    switch (op) {
                        
                        case 'equals':
                            
                            if (record[prop] == val) {
                                add_record();
                            }
                            
                            break;
                        case '==':
                        case '!=':
                        case '>':
                        case '<':
                        case '<=':
                        case '>=':
                            
                            eval('var isTrue = record[prop] ' + op + ' val ? true : false;');
                            
                            if (isTrue === true) {
                                add_record();
                            }
                            
                            break;
                        case 'in':
                            
                            switch (typeof record[prop]) {
                                
                                case 'object':
                                    
                                    if (val in record[prop]) {
                                        add_record();
                                    }
                                    
                                    break;
                                case 'string':
                                case 'number':
                                    
                                    if (record[prop].toString().indexOf(val) > -1) {
                                        add_record();
                                    }
                                    
                                    break;
                                default:
                                    throw new Error('cannot use "in" operator here.');
                            }
                            
                            break;
                        default:
                            throw new Error('invalid operator.');
                    }
                }
            }
            
            return results;
        },
        
        findAll: function() {
            return this.addedObjects.storage;
        },
        
        remove: function( obj ) {
            
            if (!this.removedObjects.has(obj)) {
                
                if (this.addedObjects.has(obj)) {
                    this.addedObjects.detach(obj);
                }
                
                this.removedObjects.attach(obj);
            }
            return this;
        },
        
        removeByUUID: function( uuid ) {
            
            if (!this.removedObjects.storage[ uuid ]) {
                
                if (this.addedObjects.storage[ uuid ]) {
                    delete this.addedObjects.storage[ uuid ];
                }
                
                this.removedObjects.storage[uuid] = {};
            }
            return this;
        },
        
        update: function( obj ) {
            
            if (this.addedObjects.has(obj)) {
                this.addedObjects.storage[ obj_hash(obj) ] = obj;
            }
            
            return this;
        },
        
        getSchemata: function() {
            return this.schemata;
        },
        
        getRelations: function( filter ) {
            return filter && this.relations[ filter ] ? this.relations[ filter ] : this.relations;
        },
        
        replace: function( oldObj, newObj ) {
            
            if (this.addedObjects.has(oldObj)) {
                this.addedObjects.detach(oldObj);
                this.addedObjects.attach(newObj);
            }
            
            return this;
        },
        
        replaceByUUID: function( uuid, obj ) {
            
            if (typeof this.addedObjects.storage[ uuid ] != 'undefined') {
                this.addedObjects.storage[ uuid ] = obj;
            }
            
            return this;
        },
        
        add: function( obj ) {
            
            if (!this.validation || (this.validation === true && this.validate(obj))) {
                
                if (this.removedObjects.has(obj)) {
                    this.removedObjects.detach(obj);
                }
                
                this.addedObjects.attach(obj);
            }
            
            return this;
        },
        
        clear: function() {
            this.db.clear(this.type);
            return this;
        },
        
        destroy: function() {
            this.db.destroy(this.type);
            return this;
        },
        
        persist: function() {
            this.db.persist(this);
            return this;
        },
        
        validate: function( obj ) {
            
            /**
             * every object added to a model passes the validation if that option
             * is enabled within the model. model.validation is set to true by
             * default for every instance. You can turn off the global model
             * validation by setting ActiveRecord.Model.fn.validation to false,
             * e.g.:
             *
             * // disabling model validation
             * ActiveRecord.Model.fn.validation = false;
             * var myStorage = $db.init('myStorage');
             * 
             */
            
            var prop, validationErrors = [];
            
            for (prop in obj) {
                
                if (prop in this.ignoredProperties) continue;
                
                if (typeof this.schemata[prop] == 'undefined') {
                    validationErrors.push('undefined model property "' + prop + '".');
                    continue;
                }
                
                switch (this.schemata[prop].type) {
                    case 'datetime':
                        if (typeof obj[prop] != 'string' || !/^\d{2,4}(\.|\/)\d{2}(\.|\/)\d{2,4} \d{2}\:\d{2}(\:\d{2})?$/.test(obj[prop])) {
                            validationErrors.push('model property "' + prop + '" must be of type ' + this.schemata[prop].type + ', ' + typeof obj[prop] + ' given.');
                            continue;
                        }
                        break;
                    case 'time':
                        if (typeof obj[prop] != 'string' || !/^\d{2}\:\d{2}(\:\d{2})?$/.test(obj[prop])) {
                            validationErrors.push('model property "' + prop + '" must be of type ' + this.schemata[prop].type + ', ' + typeof obj[prop] + ' given.');
                            continue;
                        }
                        break;
                    case 'date':
                        if (typeof obj[prop] != 'string' || !/^\d{2,4}(\.|\/)\d{2}(\.|\/)\d{2,4}$/.test(obj[prop])) {
                            validationErrors.push('model property "' + prop + '" must be of type ' + this.schemata[prop].type + ', ' + typeof obj[prop] + ' given.');
                            continue;
                        }
                        break;
                    case 'string':
                    case 'number':
                    case 'boolean':
                    case 'object':
                        if (typeof obj[prop] != this.schemata[prop].type) {
                            validationErrors.push('model property "' + prop + '" must be of type ' + this.schemata[prop].type + ', ' + typeof obj[prop] + ' given.');
                            continue;
                        }
                        break;
                }
                
                if (typeof this.schemata[prop].validate == 'function' &&
                    this.schemata[prop].validate.apply(obj[prop]) === false) {
                    validationErrors.push('value of "' + prop + '" failed validation.');
                    continue;
                }
            }
            
            if (validationErrors.length > 0) {
                throw new Error('\n\t- ' + validationErrors.join('\n\t- '));
            }
            
            return true;
        }
    }
    ActiveRecord.Model.fn.init.prototype = ActiveRecord.Model.fn;
    
})();