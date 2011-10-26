/*
Copyright (c) 2011 Alan Lindsay - version 1.1

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

	function decorateMethods(obj) {
        	
    	if (!obj) return;
    	
    	for (key in obj) {
            
            if (key === 'decorateMethod' || key === 'decorateMethods') return;
            
            if (!obj._decoratedMethods) obj._decoratedMethods = {};
            	
            if (!obj._decoratedMethods[key]) {
        
            	method = obj[key];
	            
	            if (typeof method === 'function') {

	                // Reassign method
	                obj[key] = Kernel.decorateMethod(obj, key, method);
	                
	                // Track decorated methods for later decoration calls
	                obj._decoratedMethods[key] = true;
	            }
            }
        }
    }
        
    function setDefaultHub(name) {
        defaultHub = name;
    }

    function defineModule(name, Definition) {
        modules[name] = Definition;
    }
    
    function defineHub(name, Definition) {
        
        // Create instance
        var h = new Definition(), broadcastCount = {event: 0}, callbackCount = {event: 0},
                totalElapseTime = {event: 0}, key, method, decoratedMethods = {};
        
        h._internals = {};
        h._internals.type = 'hub';
        h.id = name;
        
        // Add built-in methods - these override any definition methods
        h.broadcast = function(type, data, callback) {
            
            var i, l = listeners[type], e = listeners.event, size, eventData,
                start, diff, elapseTime = 0, listenerData = [];
            
            // Increment the broadcastCount
            broadcastCount[type] = broadcastCount[type] || 0;
            broadcastCount[type] += 1;
            broadcastCount.event += 1;
            callbackCount[type] = callbackCount[type] || 0;
            totalElapseTime[type] = totalElapseTime[type] || 0;
            
            // Cycle through the listeners and call the callbacks
            if (l) {
                
                for (i=0,size=l.length; i<size; i+=1) {
                    
                    // Measure how long it takes to complete
                    start = (new Date).getTime();
                    
                    listeners[type][i].callback(data);
                    
                    diff = (new Date).getTime() - start;
                    elapseTime += diff;
                    totalElapseTime[type] += diff;
                    totalElapseTime.event += diff;
                    
                    // Increment the listener count
                    callbackCount[type] += 1;
                    callbackCount.event += 1;
            
                    listenerData.push({
                        id: listeners[type][i].id, 
                        elapseTime: diff,
                        callback: listeners[type][i].callback
                    });
                }
            }
            
            // First cycle through the 'event' event listeners
            if (e) {
                
                eventData = {
                    type: type,
                    data: data,
                    time: new Date(),
                    listeners: listenerData,
                    broadcastCount: broadcastCount[type],
                    callbackCount: callbackCount[type],
                    elapseTime: elapseTime,
                    totalElapseTime: totalElapseTime[type],
                    all: {
                        broadcastCount: broadcastCount.event,
                        callbackCount: callbackCount.event,
                        totalElapseTime: totalElapseTime.event
                    }
                };
                
                for (i=0,size=e.length; i<size; i+=1) {
                    listeners.event[i].callback(eventData);
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
                listeners[t] = listeners[t] || [];
                listeners[t].push({callback: callback, id: id});
            }
        };
        
        h.getStats = function() {
            return {
                broadcastCount: broadcastCount,
                callbackCount: callbackCount,
                totalElapseTime: totalElapseTime
            };
        }
        
        // Decorate during instatiation
        decorateMethods(h);
        
        // Make available to outside code (for manual object manipulation)
        h.decorateMethods = decorateMethods;
        
        // Store hub in hubs array
        hubs[name] = h;
    }
    
    function extend(obj1, obj2, deep) {
        
        var key;
        
        // Filter out null values
        if (obj2 === null) return obj1;
        
        if (obj1._internals && (obj1._internals.type === 'module' || obj1._internals.type === 'hub') ) {
	        
	        // Decorate new methods
	        decorateMethods(obj1);
       }
                
        // Loop through the keys
        for (key in obj2) {

            if (obj2.hasOwnProperty(key)) {
                
                // Skip duplicates
                if (obj1[key] === obj2[key]) continue;
                
                // falsy values automatically get overwritten
                if (!obj1[key] && obj2[key]) {
                	
                	obj1[key] = obj2[key];
                } 
                else if (deep && typeof obj1[key] === 'object') {
                    // Recursive merge
                    extend(obj1[key], obj2[key], true);
                }
                else {
                    
                    if (obj1._internals && obj1._internals.type === 'Kernel') {
                
                        // Disallow overwriting base objects
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
                        if (key === 'id') throw "You can't overwrite a module instance id.";
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
        
        var hub = hub || defaultHub, instance, key, method, tmp;
            
        registered[id] = {};
        registered[id].hub = hubs[hub];
        registered[id].Definition = modules[type];
        registered[id].started = false;
        
        // Create a module instance
        try {
            instance = new registered[id].Definition(registered[id].hub);
        }
        catch (e) {
            throw "Couldn't register module: ["+id+"] - missing or broken Definition: "+e.message;
        }
        
        // Add built-in methods to instance
        instance._internals = {};
        instance._internals.type = 'module';
        instance.kill = instance.kill || function() {};
        instance.id = id;
        
        // Merge config into instance
        if (config) extend(instance, config, true);
        
        // Wrap all the methods in try/catch blocks
        for (key in instance) {
            
            method = instance[key];
            
            if (typeof method === 'function') {
                
                // Reassign method
                instance[key] = Kernel.decorateMethod(instance, key, method);
            }
        }
        
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
        decorateMethod: function(instance, name, method) {
            
            return function() {
                
                try {
                    return method.apply(this, arguments);
                }
                catch (e) {
                    throw e;
                }
            }
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
        version: '1.1',
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

// Define an empty router
Kernel.hub.define('main', function(){});