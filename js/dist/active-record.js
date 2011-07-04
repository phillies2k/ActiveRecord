

/*!
 * ActiveRecord v1.3.0
 *
 * Copyright (c) 2011 Philipp Boes
 * https://github.com/phillies2k/ActiveRecord/
 * 
 * Published under the GPL License.
 *
 * Includes MD5 (Message-Digest Algorithm)
 * http://www.webtoolkit.info/
 *
 * Last-Modified: 07/03/11
 *
 */

if (!Object.prototype.watch) {
    
    Object.prototype.watch = function (prop, handler) {
        
        var oldval = this[prop],
            newval = oldval,
            getter = function () {
                    return newval;
            },
            setter = function (val) {
                    oldval = newval;
                    return newval = handler.call(this, prop, oldval, val);
            };
        
        if (delete this[prop]) { // can't watch constants
            if (Object.defineProperty) { // ECMAScript 5
                Object.defineProperty(this, prop, {
                    get: getter,
                    set: setter
                });
            } else if (Object.prototype.__defineGetter__ &&
                       Object.prototype.__defineSetter__) { // legacy
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

var ActiveRecord = function( db, options ){
    
    if (!db || typeof db != 'string') {
        throw new Error('ActiveRecord.init must have at least one argument, ' +
                        'the storage name to access (e.g. $db("myStorage"))');
    }
    
    this.settings = ActiveRecord.extend(ActiveRecord.settings, options);
    var backend = new ActiveRecord.DB( db );
    
    this.__defineGetter__('methods', ActiveRecord.method_names);
    this.__defineGetter__('db', function(){ return backend; });
    
    return this;
}

ActiveRecord.extend = function() {
    
    var target = arguments[0],
        len = arguments.length,
        i = 1,
        src, g, s, p;
    
    for ( ; i < len; i++ ) {
        
        src = arguments[i];
        
        for (p in src) {
            
            g = src.__lookupGetter__(p);
            s = src.__lookupSetter__(p);
            
            if (g || s) {
                
                if (g) target.__defineGetter__(p, g);
                if (s) target.__defineSetter__(p, s);
                
            } else if (typeof target[p] == 'undefined') {
                
                target[p] = src[p];
                
            }
        }
    }
    
    return target;
}

ActiveRecord.extend(ActiveRecord, {
    
    VERSION: '1.3.0',
    
    BELONGS_TO: 1,
    BELONGS_TO_AND_HAS_MANY: 2,
    HAS_ONE: 3,
    HAS_MANY: 4,
    
    SORT_ASC: 'asc',
    SORT_DESC: 'desc',
    
    SYNC_ONE_WAY: 0,
    SYNC_TWO_WAY: 1,
    
    IGNORED_PROPS: {
        __guid__    : true,
        __proto__   : true,
        prototype   : true,
        watch       : true,
        unwatch     : true
    },
    
    MAGIC_PROPS: {
        __belongsTo             : true,
        __belongsToAndHasMany   : true,
        __hasMany               : true,
        __hasOne                : true
    },
    
    settings: {
        syncUrl: null,
        syncMode: 0,
        sync: false,
        method: 'GET',
        user: null,
        pass: null,
        params: null
    },
    
    serialize: function( obj ) {
        
        var e = encodeURIComponent,
            s = [], p,
            
            add = function( k, v ) {
                v = typeof v == 'function' ? v() : v;
                s[ s.length ] = e(k) + '=' + e(v);
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
        
        for (p in obj) buildParams(p, obj[p]);
        return s.join( "&" ).replace( /%20/g, "+" );
    },
    
    obj_hash: function( object ) {
        return MD5(object.__guid__.toString());
    },
    
    method_names: function( obj ) {
        
        var fn = obj && obj.__proto__ || this.__proto__,
            res = [], name;
        
        for (name in fn) {
            
            if (name === '__proto__' ||
                name === 'constructor' ||
                fn[name].__lookupGetter__(name) ||
                fn[name].__lookupSetter__(name)) continue;
            
            else res.push(name);
        }
        
        return res;
    }
});

ActiveRecord.prototype = {
    constructor: ActiveRecord,
    
    getUUIDFromObject: function( obj ) {
        return ActiveRecord.obj_hash(obj);
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
    
    clearAll: function() {
        
        var type, all = this.getAll();
        
        for (type in all) {
            this.db.clear(type);
        }
        
        return this;
    },
    
    destroy: function( type ) {
        this.db.destroy(type);
        return this;
    },
    
    destroyAll: function() {
        
        var type, all = this.getAll();
        
        for (type in all) {
            this.db.destroy(type);
        }
        
        return this;
    },
    
    create: function( type, schemata ) {
        return this.db.create(type, schemata);
    },
    
    persist: function( model ) {
        return this.db.persist(model);
    },
    
    persistAll: function() {
        return this.db.persistAll();
    }
}

/**
 * ActiveRecord.DB
 */

ActiveRecord.DB = function( storage ) {
    
    this.storage = storage;
    this.records = {};
    
    return this;
}

ActiveRecord.DB.prototype = {
    
    constructor: ActiveRecord.DB,
    
    clear: function( type ) {
        
        var model = this.get(type);
        
        model.removedObjects.clear();
        model.addedObjects.clear();
        
        localStorage.setItem( this.storage + '.' + type, JSON.stringify([
            model.getSchemata(),
            model.getRelations(),
            {}
        ], function(key, val){
            return this[key] instanceof Function ? this[key].toString() : val;
        }));
        
        this.records[ type ] = model;
        
        return model;
    },
    
    destroy: function( type ) {
        delete this.records[ type ];
        localStorage.removeItem(this.storage + '.' + type);
    },
    
    has: function( type ) {
        return !!localStorage.getItem( this.storage + '.' + type );
    },
    
    create: function( type, schemata ) {
        
        if (this.has(type)) {
            throw new Error('a model of that type already exists in this storage.');
        }
        
        var model = new ActiveRecord.Model(type, schemata, this);
        this.records[ type ] = model;
        
        return this.records[ type ];
    },
    
    getAll: function() {
        
        var p, raw, results = {}, type;
        
        for (p in localStorage) {
            
            if (p.indexOf(this.storage + '.') === 0) {
                
                type = p.substr(this.storage.length+1);
                results[type] = this.get(type);
            }
        }
        
        return results;
    },
    
    get: function( type ) {
        
        if (this.has(type)) {
            
            if (!this.records[ type ]) {
                
                try {
                    
                    var raw = JSON.parse(localStorage.getItem( this.storage + '.' + type ), function(key, val) {
                            
                            if (typeof val == 'string' && /^function\s*\(/.test(val)) {
                                eval('val = ' + val);
                            }
                            return val;
                        }),
                        model = new ActiveRecord.Model(type, raw[0], this), uuid;
                    
                    model.relations = raw[1];
                    
                    for (uuid in raw[2]) {
                        model.add(raw[2][uuid]);
                    }
                    
                    this.records[ type ] = model;
                    
                } catch (e) {
                    
                    console.log(e);
                    
                }
            }
            
            return this.records[ type ];
        }
        
        return false;
    },
    
    persist: function( model ) {
        
        try {
            
            var added = model.addedObjects.toObject(),
                removed = model.removedObjects.toObject(),
                repo = this.storage + '.' + model.type,
                uuid ,
                dump = localStorage.getItem(repo),
                n;
            
            dump = dump ? JSON.parse(dump) :
                        [ model.getSchemata(), model.getRelations(), {} ];
            
            for (uuid in added) {
                
                if (/^[a-z0-9]{32}$/.test(uuid)) {
                    
                    for (n in added[uuid]) {
                        if (n in model.ignoredProperties) {
                            delete added[uuid][n];
                        }
                    }
                    
                    dump[2][uuid] = added[uuid];
                }
            }
            
            for (uuid in removed) {
                
                if (dump[2][uuid]) {
                    delete dump[2][uuid];
                }
            }
            
            localStorage.setItem(repo, JSON.stringify(dump, function(key, val){
                return val instanceof Function ? val.toString() : val;
            }));
            
        } catch(e) {
            
            console.log(e);
            
        } finally {
            return true;
        }
    },
    
    persistAll: function() {
        
        for (var type in this.records) {
            
            this.persist(this.records[type]);
        }
    }
}

/**
 * ActiveRecord.Model
 */

ActiveRecord.Model = function( type, schemata, db ) {
    
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
        if (prop in ActiveRecord.IGNORED_PROPS) continue;
        else if (prop in ActiveRecord.MAGIC_PROPS) {
            this.relations[prop] = schemata[prop].split(/\s*,\s*/);
        } else {
            this.schemata[prop] = schemata[prop];
        }
    }
    
    this.addedObjects = new ActiveRecord.Storage;
    this.removedObjects = new ActiveRecord.Storage;
    
    return this;
}

ActiveRecord.Model.prototype = {
    
    constructor: ActiveRecord.Model,
    
    db: null,
    
    validation: true,
    
    addedObjects: null,
    
    removedObjects: null,
    
    schemata: {},
    
    relations: {},
    
    type: '',
    
    dirty: false,
    
    findByUUID: function( uuid ) {
        
        if (typeof this.addedObjects.storage[ uuid ] != 'undefined') {
            return new ActiveRecord.Set(this.addedObjects.storage[ uuid ]);
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
            results = { length: 0 },
            self = this,
            uuid, record, modelType,
            
            add_record = function() {
                
                if (results.length >= offset &&
                    (!limit || limit && results.length < limit)) {
                    
                    results[uuid] = record;
                    ++results.length;
                }
            },
            
            auto_wire_relations = function() {
                
                var res = {}, rel, i, mtype, model, curr;
                
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
        
        return new ActiveRecord.Set(results);
    },
    
    findAll: function() {
        return new ActiveRecord.Set(this.addedObjects.storage);
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
            this.addedObjects.storage[ ActiveRecord.obj_hash(obj) ] = obj;
        }
        
        return this;
    },
    
    getSchemata: function() {
        return this.schemata;
    },
    
    getRelations: function( filter ) {
        return filter && this.relations[ filter ] ? this.relations[ filter ] :
                                                    this.relations;
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
        
        if (!this.validation ||
            (this.validation === true && (obj = this.validate(obj)))) {
            
            if (!obj.hasOwnProperty('__guid__')) {
                obj.__defineGetter__('__guid__', (function() {
                    
                    var gid = 0;
                    
                    return function() {
                        
                        var id = (new Date()).getTime() + '_' + (++gid);
                        
                        this.__proto__ = {
                            
                            __proto__: this.__proto__,
                            
                            get __guid__() { return id; }
                        };
                        
                        return id;
                    }
                    
                })());
            }
            
            if (this.removedObjects.has(obj)) {
                this.removedObjects.detach(obj);
            }
            
            this.addedObjects.attach(obj);
        }
        
        return this;
    },
    
    clear: function() {
        return this.db.clear(this.type);
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
         * 
         * // any ActiveRecord instances will now validate no model anymore.
         * 
         */
        
        var prop, errors = [], exp, type;
        
        for (prop in obj) {
            
            if (prop in ActiveRecord.IGNORED_PROPS || /^\d+$/.test(prop)) continue;
            
            if (typeof this.schemata[prop] == 'undefined') {
                errors.push('undefined model property "' + prop + '".');
                continue;
            }
            
            type = this.schemata[prop].type;
            
            switch (type) {
                case 'datetime':
                    exp = /^\d{2,4}(\.|\/)\d{2}(\.|\/)\d{2,4} \d{2}\:\d{2}(\:\d{2})?$/;
                case 'time':
                    exp = exp || /^\d{2}\:\d{2}(\:\d{2})?$/;
                case 'date':
                    
                    exp = exp || /^\d{2,4}(\.|\/)\d{2}(\.|\/)\d{2,4}$/;
                    type = 'string';
                    
                    if (typeof obj[prop] != type) {
                        
                        errors.push('model property "' + prop + '" must be of ' +
                                    'type ' + type + ', ' + typeof obj[prop] +
                                    ' given.');
                        
                        continue;
                    }
                    
                    break;
                case 'string':
                case 'number':
                case 'boolean':
                case 'object':
                    
                    if (typeof obj[prop] != type) {
                        
                        errors.push('model property "' + prop + '" must be of ' +
                                    'type ' + type + ', ' + typeof obj[prop] +
                                    ' given.');
                        
                        continue;
                    }
                    
                    break;
            }
            
            if (typeof this.schemata[prop].sanitize == 'function') {
                obj[prop] = this.schemata[prop].sanitize(obj[prop]);
            }
            
            if (typeof this.schemata[prop].validate == 'function' &&
                this.schemata[prop].validate.apply(obj[prop]) === false) {
                
                errors.push('value of "' + prop + '" failed validation.');
                continue;
            }
        }
        
        if (errors.length > 0) {
            throw new Error('\n\t- ' + errors.join('\n\t- '));
        }
        
        return obj;
    }
}

/**
 * ActiveRecord.Set
 */

ActiveRecord.Set = function( records ) {
    
    this.length = 0;
    
    var prop, obj;
    
    for (prop in records) {
        
        if (prop in ActiveRecord.IGNORED_PROPS) continue;
        
        obj = records[ prop ];
        
        if (!obj.hasOwnProperty('__guid__')) {
            
            obj.__defineGetter__('__guid__', (function() {
                
                var gid = 0;
                
                return function() {
                    
                    var id = (new Date()).getTime() + (++gid);
                    
                    this.__proto__ = {
                        
                        __proto__: this.__proto__,
                        
                        get __guid__() { return id; }
                    };
                    
                    return id;
                }
                
            })());
        }
        
        this[ (++this.length) - 1 ] = records[ prop ];
    }
    
    return this;
}

ActiveRecord.Set.prototype = {
    constructor: ActiveRecord.Set,
    
    get: function( index ) {
        return !!this[index] && this[index];
    },
    
    each: function( fn ) {
        
        var set = Array.prototype.slice.call(this, 0),
            len = set.length;
        
        for (; i < len; i++) {
            if (typeof fn == 'function') {
                fn.call(set[i], i , set);
            }
        }
        
        return this;
    },
    
    sort: function( prop, flag ) {
        flag = flag || prop;
        
        return Array.prototype.slice.call(this, 0).sort(function( a, b ) {
            
            return prop && typeof a[prop] != 'undefined' ?
                ( flag == 'ASC' ?
                    a[prop] - b[prop] :
                    b[prop] - a[prop]
                ) :
                ( flag == 'ASC' ?
                    a.__guid__ - b.__guid__ :
                    b.__guid__ - a.__guid__
                );
        });
    }
}

/**
 * ActiveRecord.Storage
 */

ActiveRecord.Storage = function() {
    
    this.length = 0;
    
    return this;
}

ActiveRecord.Storage.prototype = {
    
    constructor: ActiveRecord.Storage,
    
    has: function( obj ) {
        return !!this[ ActiveRecord.obj_hash(obj) ];
    },
    
    attach: function( obj ) {
        if (!this.has(obj)) {
            this[ ActiveRecord.obj_hash(obj) ] = obj;
            ++this.length;
        }
    },
    
    detach: function( obj ) {
        if (this.has(obj)) {
            delete this[ ActiveRecord.obj_hash(obj) ];
            --this.length;
        }
    },
    
    toObject: function() {
        var ret = {}, p;
        for (p in this) {
            if (/^[a-z0-9]{32}$/.test(p)) {
                ret[p] = this[p];
            }
        }
        return ret;
    }
}