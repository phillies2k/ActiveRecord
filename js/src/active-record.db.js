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