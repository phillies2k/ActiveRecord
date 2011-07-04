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