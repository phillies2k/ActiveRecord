/*!
 * ActiveRecord v1.1
 *
 * Copyright (c) 2011 Philipp Boes
 * https://github.com/phillies2k/active-record/
 * 
 * Licensed under the GPL License.
 *
 */

(function(){
    
    function obj_hash( obj ) {
        var _guid = 0;
        return (function(o) {
            if (!o.__uuid__) {
                for (var p in o) 
                var id = (new Date()).getTime() + '_' + (++_guid);
                o.__defineGetter__('__uuid__', function(){
                    this.__proto__ = {
                        __proto__: this.__proto__,
                        get __uuid__() { return id; }
                    }
                    return id;
                });
                return id;
            }
            return o.__uuid__;
        })(obj);
    }
    
    window.$storage = window.localStorage = localStorage;
    window.ActiveRecord = window.$db = ActiveRecord = {
        
        SORT_ASC:   'asc',
        SORT_DESC:  'desc',
        
        BELONGS_TO:                 1,
        BELONGS_TO_AND_HAS_MANY:    2,
        HAS_MANY:                   3,
        HAS_ONE:                    4,
        
        settings: {
            syncUrl: null,
            syncMode: 0,
            sync: false,
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
        
        Model: function( type, schemata ) {
            return new ActiveRecord.Model.fn.init(type, schemata);
        },
        
        init: function( db, options ) {
            
            for (var opt in options) {
                this.settings[opt] = options[opt];
            }
            
            return new ActiveRecord.fn.init(db);
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
        }
    };
    
    ActiveRecord.Storage.fn.init.prototype = ActiveRecord.Storage.fn;
    
    ActiveRecord.fn = ActiveRecord.prototype = {
        constructor: ActiveRecord,
        
        db: null,
        
        init: function( db ) {
            this.db = new ActiveRecord.DB(db);
            return this;
        },
        
        getUUIDFromObject: function( obj ) {
            return obj_hash(obj);
        },
        
        get: function( type ) {
            return this.db.get(type);
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
            
            var model = new ActiveRecord.Model(type, schemata);
            this.persist(model);
            this.repositories[ type ] = model;
            
            return this.repositories[ type ];
        },
        
        get: function( type ) {
            
            if (this.has(type)) {
                
                if (!this.repositories[ type ]) {
                    var raw = JSON.parse($storage.getItem( this.storage + '.' + type )),
                        model = new ActiveRecord.Model(type, raw[0]), uuid;
                    
                    for (uuid in raw[1]) {
                        model.add(raw[1][uuid]);
                    }
                    
                    this.repositories[ type ] = model;
                }
                
                return this.repositories[ type ];
            }
            
            return false;
        },
        
        persist: function( model ) {
            
            var added = model.addedObjects.storage,
                removed = model.removedObjects.storage,
                repo = this.storage + '.' + model.type,
                uuid , dump = $storage.getItem(repo);
            
            dump = dump ? JSON.parse(dump) : [ model.getSchemata(), {} ];
            
            for (uuid in added) {
                dump[1][uuid] = added[uuid];
            }
            
            for (uuid in removed) {
                if (dump[1][uuid]) {
                    delete dump[1][uuid];
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
        
        validation: true,
        
        addedObjects: null,
        
        removedObjects: null,
        
        schemata: {},
        
        relations: {},
        
        type: false,
        
        init: function( type, schemata ) {
            
            if (typeof type !== 'string') {
                throw new Error('type must be of type string.');
            }
            
            if (typeof schemata != 'object') {
                throw new Error('invalid model schemata given.');
            }
            
            this.type = type.toLowerCase();
            
            for (var prop in schemata) {
                
                if (prop in this.magicProperties) {
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
            
            op = op || 'equals';
            
            var records = this.addedObjects.storage,
                uuid, record, results = { length: 0 },
                add_record = function( u, r ) {
                    if (results.length >= offset && (!limit || limit && results.length < limit)) {
                        results[u] = r;
                        ++results.length;
                    }
                };
            
            for (uuid in records) {
                
                record = records[ uuid ];
                
                if (typeof record[prop] != 'undefined') {
                    
                    switch (op) {
                        
                        case 'equals':
                            
                            if (record[prop] == val) {
                                add_record(uuid, record);
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
                                add_record(uuid, record);
                            }
                            
                            break;
                        case 'in':
                            
                            switch (typeof record[prop]) {
                                
                                case 'object':
                                    
                                    if (val in record[prop]) {
                                        add_record(uuid, record);
                                    }
                                    
                                    break;
                                case 'string':
                                case 'number':
                                    
                                    if (record[prop].toString().indexOf(val) > -1) {
                                        add_record(uuid, record);
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
            
            return ;
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
        },
        
        removeByUUID: function( uuid ) {
            
            if (!this.removedObjects.storage[ uuid ]) {
                
                if (this.addedObjects.storage[ uuid ]) {
                    delete this.addedObjects.storage[ uuid ];
                }
                
                this.removedObjects.storage[uuid] = {};
            }
        },
        
        update: function( obj ) {
            if (this.addedObjects.has(obj)) {
                this.addedObjects.storage[ obj_hash(obj) ] = obj;
            }
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
        },
        
        replaceByUUID: function( uuid, obj ) {
            if (typeof this.addedObjects.storage[ uuid ] != 'undefined') {
                this.addedObjects.storage[ uuid ] = obj;
            }
        },
        
        add: function( obj ) {
            if (!this.validation || (this.validation === true && this.validate(obj))) {
                
                if (this.removedObjects.has(obj)) {
                    this.removedObjects.detach(obj);
                }
                
                this.addedObjects.attach(obj);
            }
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