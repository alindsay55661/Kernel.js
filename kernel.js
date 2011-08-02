/*
Copyright (c) 2011 Alan Lindsay - version 0.9.10

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
(Kernel = function() {
    
    var self = this, 
        core, hubs = {}, modules = {}, registered = {},
        listeners = {},
        defaultHub = 'main';

    function setDefaultHub(name) {
        defaultHub = name;
    }

    function defineModule(name, Definition) {
        modules[name] = Definition;
    }
    
    function defineHub(name, Definition) {
        // Create instance
        var h = new Definition();
        
        // Add built-in methods - these override any definition methods
        h.broadcast = function(type, data, callback) {
            
            var i, l = listeners[type], e = listeners.event, size, eventData;
            
            // First cycle through the 'event' event listeners
            if (e) {
                
                eventData = {
                    type: type,
                    data: data,
                    time: new Date(),
                    listeners: l
                }
                
                for (i=0,size=e.length; i<size; i+=1) {
                    listeners.event[i].callback(eventData);
                }
            }
            
            // Cycle through the listeners and call the callbacks
            if (l) {
                
                for (i=0,size=l.length; i<size; i+=1) {
                    listeners[type][i].callback(data);
                }
            }
            
            // Handle callback if provided
            if (callback) callback();
        };
        
        h.listen = function(type, callback, instance) {
            
            if (!instance) {
                throw 'Listen requires the module instance as the 3rd parameter.';
            }
            
            var i, size, t, tmp = [], id = instance.id;
            
            // Cast to array
            if (type.constructor.toString().indexOf('Array') === -1) {
                tmp.push(type);
                type = tmp;
            }
            
            for (i=0,size=type.length; i<size; i+=1) {
                
                t = type[i];
                
                // Force array 
                listeners[t] = listeners[t] ? listeners[t] : [];
                listeners[t].push({callback: callback, id: id});
            }
        };
        
        hubs[name] = h;
    }
    
    // Define an empty router
    defineHub('main', function(){});
    
    function extend(obj1, obj2, deep) {
        
        var key;
        
        // Filter out null values
        if (obj2 === null) return obj1;
        
        // Loop through the keys
        for (key in obj2) {

            if (obj2.hasOwnProperty(key)) {
                
                // falsy values automatically get overwritten
                if (!obj1[key] && obj2[key]) obj1[key] = obj2[key];
                
                // Skip duplicates
                if (obj1[key] === obj2[key]) continue;
                
                if (deep && typeof obj1[key] === 'object') {
                    // Recursive merge
                    extend(obj1[key], obj2[key], true);
                }
                else {
                    
                    if (obj1._internals && obj1._internals.type === 'Kernel') {
                
                        // Disallow overwriting base methods
                        switch (key) {
                            case 'extend':
                            case 'module':
                            case 'register':
                            case 'hub':
                            case 'start':
                            case 'stop':
                                throw "You can't extend '"+key+"', it's part of kernel's base functionality.";
                                break;
                            
                            default:
                                // Assignment below
                        }
                    }
                    else if (obj1._internals && obj1._internals.type === 'module') {
                        
                        // Disallow overridding module ids
                        if (key === 'id') throw "You can't overwrite an module instance id.";
                    }
                    
                    // Make the assignment
                    obj1[key] = obj2[key];
                }
            }
        }
        
        return obj1;
    }
    
    // This will create a module instance - but it won't call its init method.
    function registerModule(id, type, hub, config) {
        
        var hub = hub || defaultHub, instance;
            
        registered[id] = {};
        registered[id].hub = hubs[hub];
        registered[id].Definition = modules[type];
        registered[id].started = false;
        
        // Create a module instance
        try {
            instance = new registered[id].Definition(registered[id].hub);
        }
        catch (e) {
            throw "Missing or broken module definition ["+id+"] - did you forget to include the file? ";
        }
        
        // Add built-in methods to instance
        instance._internals = {};
        instance._internals.type = 'module';
        instance.kill = instance.kill || function() {};
        instance.id = id;
        
        // Merge config into instance
        if (config) extend(instance, config, true);
        
        // Save the instance
        registered[id].instance = instance;
    }
    
    function startModule(id, config, core) {
        
        // Merge config into instance
        if (config) extend(registered[id].instance, config, true);
        
        // Flag the module
        registered[id].started = true;
        
        // Initialize the module
        core.onStart(registered[id].instance);
    }
    
    core = {
        extend: extend,
        module: {
            define: defineModule,
            get: function(id) {
                return registered[id].instance;
            },
            isStarted: function(id) {
                return registered[id].started;
            }
        },
        hub: {
            define: defineHub,
            get: function(id) {
                return hubs[id];
            }
        },
        register: function(id, type, hub, config) {
            
            var i;
            
            // Check to see if an array is being used
            if (id.constructor.toString().indexOf('Array') === -1) {
                
                registerModule(id, type, hub, config);
            }
            else {
                // Register all the modules
                for (i=0; i<id.length; i+=1) {
                    
                    registerModule(id[i].id, id[i].type, id[i].hub, id[i].config);
                }
            }
        },
        start: function(id, config) {
            
            var i;
            
            // Check to see if an array is being used
            if (id.constructor.toString().indexOf('Array') === -1) {
                
                startModule(id, config, this);
                
            }
            else {
                // Start all the modules
                for (i=0; i<id.length; i+=1) {
                    
                    startModule(id[i].id, id[i].config, this);
                }
            }
        },
        startAll: function() {
            
            var key;
            
            for (key in registered) {
                
                startModule(key, null, this);
            }
        },
        onStart: function(instance) {
            instance.init();
        },
        stop: function(id) {
            
            var key, i, size, listener;
            
            // Call the module kill method first
            this.onStop(registered[id].instance);
            
            // Wipe out any listeners
            for (key in listeners) {
                
                // Cycle through each type
                for (i=0,size=listeners[key].length; i<size; i+=1) {
                    
                    listener = listeners[key][i];
                    
                    if (listener.id === id) listeners[key].splice(i, 1);
                }
            }
            
            // Flag the module
            registered[id].started = false;
        
        },
        onStop: function(instance) {
            instance.kill();
        },
        version: '0.9.10',
        _internals: {
            PRIVATE: 'FOR DEBUGGING ONLY',
            type: 'Kernel',
            hubs: hubs,
            modules: modules,
            registered: registered,
            listeners: listeners
        }
    };
    
    return core;
    
}());