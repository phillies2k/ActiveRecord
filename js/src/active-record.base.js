/*!
 * ActiveRecord v$Id$
 *
 * Copyright (c) 2011 Philipp Boes
 * https://github.com/phillies2k/ActiveRecord/
 * 
 * Published under the GPL License.
 *
 * Includes MD5 (Message-Digest Algorithm)
 * http://www.webtoolkit.info/
 *
 * Last-Modified: $dateTime$
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
    
    VERSION: '$Id$',
    
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