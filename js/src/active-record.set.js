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