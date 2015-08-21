var _ = require('underscore'),
    defaults = require('views/lib/app_settings');

(function () {

  'use strict';

  var inboxServices = angular.module('inboxServices');

  inboxServices.factory('Settings', ['DB', 'Cache',
    function(DB, Cache) {

      var cache = Cache(function(callback) {
        DB.get()
          .get('medic-settings')
          .then(function(doc) {
            callback(null, doc);
          }).catch(callback);
      });

      return function(callback) {
        cache(function(err, doc) {
          if (err) {
            return callback(err);
          }
          callback(null, _.defaults(doc.app_settings, defaults));
        }); 
      };

    }
  ]);

}()); 
