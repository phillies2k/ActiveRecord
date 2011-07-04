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