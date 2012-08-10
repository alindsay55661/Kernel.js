Kernel.extend(Kernel.hub.get('main'), {

  // Namespace
  util: {

    base64Encode: function(str) {

      return window.btoa(str);

    },

    base64Decode: function(data) {

      return window.atob(data);

    }

  }

});