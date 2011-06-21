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
        
        init: function( db, options ) {
            return new ActiveRecord.fn.init(db, options);
        }
    }
    
    ActiveRecord.Storage = function() {
        return new ActiveRecord.Storage.fn.init();
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
    
    ActiveRecord.DB = function( db ) {
        return new ActiveRecord.DB.fn.init(db);
    }
    
    ActiveRecord.Model = function( type, schemata, relations ) {
        return new ActiveRecord.Model.fn.init(type, schemata, relations);
    }
    
    ActiveRecord.fn = ActiveRecord.prototype = {
        constructor: ActiveRecord,
        
        settings: {
            syncUrl: null,
            syncMode: 0,
            sync: false,
            user: null,
            pass: null,
            params: null
        },
        
        db: null,
        
        init: function( db, options ) {
            
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
        
        commit: function( model ) {
            return this.db.commit(model);
        },
        
        clear: function( type ) {
            return this.db.clear(type);
        },
        
        destroy: function( type ) {
            return this.db.destroy(type);
        },
        
        create: function( type, schemata, relations ) {
            return this.db.create(type, schemata, relations);
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
        
        create: function( type, schemata, relations ) {
            
            if (this.has(type)) {
                throw new Error('a model of that type already exists in this storage.');
            }
            
            var model = new ActiveRecord.Model(type, schemata, relations);
            this.persist(model);
            this.repositories[ type ] = model;
            
            return this.repositories[ type ];
        },
        
        get: function( type ) {
            
            if (this.has(type)) {
                
                if (!this.repositories[ type ]) {
                    var raw = JSON.parse($storage.getItem( this.storage + '.' + type )),
                        model = new ActiveRecord.Model(type, raw[0], raw[1]), uuid;
                    
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
            
            var added = model.addedObjects.storage,
                removed = model.removedObjects.storage,
                repo = this.storage + '.' + model.type,
                uuid , dump = $storage.getItem(repo);
            
            dump = dump ? JSON.parse(dump) : [ model.getSchemata(), model.getRelations(), {}];
            
            for (uuid in added) {
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
        
        validation: true,
        
        addedObjects: null,
        
        removedObjects: null,
        
        schemata: false,
        
        relations: false,
        
        type: false,
        
        init: function( type, schemata, relations ) {
            
            if (typeof type !== 'string') {
                throw new Error('type must be of type string.');
            }
            
            if (typeof schemata != 'object') {
                throw new Error('invalid model schemata given.');
            }
            
            this.type = type.toLowerCase();
            this.schemata = schemata;
            this.relations = relations || {};
            
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
                
                if (typeof obj[prop] != this.schemata[prop].type) {
                    validationErrors.push('model property "' + prop + '" must be of type ' + this.schemata[prop].type + ', ' + typeof obj[prop] + ' given.');
                    continue;
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