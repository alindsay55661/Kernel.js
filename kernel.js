/*
Copyright (c) 2011 Alan Lindsay - version 0.8.3

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
(K = Kernel = function()
{
    var self = this, 
        core, routers = {}, modules = {}, registered = {},
        listeners = {},
        defaultRouter = 'main';

    function setDefaultRouter(name)
    {
        defaultRouter = name;
    }

    function defineModule(name, Definition)
    {
        modules[name] = Definition;
    }
    
    function defineRouter(name, Definition)
    {
        // Create instance
        var r = new Definition();
        
        // Add built-in methods - these override any definition methods
        r.notify = function(bundle)
        {
            var i, type = bundle.type, data = bundle.data,
                l = listeners[type], length;
            
            // Cycle through the listeners and call the callbacks
            if (l)
            {
                length = l.length;
                
                for (i=0; i<length; i+=1)
                {
                    listeners[type][i].callback(data);
                }
            }
        };
        
        r.listen = function(type, callback, instance)
        {
            if (!instance)
            {
                throw 'Module instance required as third parameter to listen.';
            }
            
            var i, tmp = [], id = instance.id;
            
            // Cast to array
            if (type.constructor.toString().indexOf('Array') == -1)
            {
                tmp.push(type);
                type = tmp;
            }
            
            for (i=0; i<type.length; i+=1)
            {
                var t = type[i];
                
                // Force array 
                listeners[t] = listeners[t] ? listeners[t] : [];
                listeners[t].push({callback: callback, id: id});
            }
        };
        
        routers[name] = r;
    }
    
    function extend(config)
    {
        var key;
        
        for (key in config)
        {
            // Disallow overwriting base methods
            switch (key)
            {
                case 'extend':
                case 'getModule':
                case 'getRouter':
                case 'module':
                case 'register':
                case 'router':
                case 'start':
                case 'stop':
                    throw "You can't extend '"+key+"', its an part of kernel's base functionality.";
                    break;
                
                default:
                    core[key] = config[key];
            }
        }
    }
    
    core = {
        extend: extend,
        module: {define: defineModule},
        getModule: function(id)
        {
            return registered[id].instance;
        },
        getRouter: function(id)
        {
            return routers[id];
        },
        router: {define: defineRouter},
        register: function(id, type, router)
        {
            var router = router || defaultRouter;
            
            registered[id] = {};
            registered[id].router = routers[router];
            registered[id].Defition = modules[type];
            registered[id].instance = null;
        },
        start: function(id, config)
        {
            var instance;
             
            // Create a module instance
            instance = new registered[id].Defition(registered[id].router);
            
            // Add built-in methods to instance
            instance.kill = instance.kill || function() {};
            instance.id = id; 
            
            // Merge config into instance
            if (config)
            {
                for (key in config)
                {
                    // Allow overridding of everything but 'id' including 'init' and 'kill'
                    if (key != 'id')
                    {
                        instance[key] = config[key];
                    }
                    else
                    {
                        throw "Cannot override instance id!";
                    }
                }
            }
            
            // Save the instance
            registered[id].instance = instance;
            
            // Initialize the module
            this.onStart(instance, config);
        },
        onStart: function(instance, config)
        {
            instance.init();
        },
        stop: function(id)
        {
            var key, i, listener;
            
            // Call the module kill method first
            this.onStop(registered[id].instance);
            
            // Wipe out any listeners
            for (key in listeners)
            {
                // Cycle through each type
                for (i=0; i<listeners[key].length; i+=1)
                {
                    listener = listeners[key][i];
                    
                    if (listener.id == id)
                    {
                        
                        listeners[key].splice(i, 1);
                    }
                }
            }
            
            // Destroy module instance
            registered[id].instance = null;
        },
        onStop: function(instance)
        {
            instance.kill();
        },
        _internals: {
            PRIVATE: 'FOR DEBUGGING ONLY',
            modules: modules,
            registered: registered,
            listeners: listeners
        }
    };
    
    return core;
    
}());