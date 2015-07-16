var _ = require('underscore'),
    moment = require('moment'),
    countries = require('../modules/countries');

(function () {

  'use strict';

  var inboxControllers = angular.module('inboxControllers');

  var standard_date_formats = [
    'DD-MMM-YYYY',
    'DD/MM/YYYY',
    'MM/DD/YYYY'
  ];

  var standard_datetime_formats = [
    'DD-MMM-YYYY HH:mm:ss',
    'DD/MM/YYYY HH:mm:ss',
    'MM/DD/YYYY HH:mm:ss'
  ];

  var generateTimeModels = function(max, increment) {
    var result = [],
        i;

    increment = increment || 1;

    for (i = 0; i < max; i += increment) {
      result.push({
        name: (i < 10 ? '0' : '') + i,
        value: i
      });
    }
    return result;
  };
  
  var validate = function(model, translateFilter) {
    var errors = { found: false, fields: {} };
    var morning = model.schedule_morning_hours * 60 + model.schedule_morning_minutes;
    var evening = model.schedule_evening_hours * 60 + model.schedule_evening_minutes;
    if (morning >= evening) {
      errors.found = true;
      errors.fields.messagingWindow = translateFilter('The first time must be earlier than the second time');
    }
    return errors;
  };

  inboxControllers.controller('ConfigurationSettingsAdvancedCtrl',
    ['$scope', '$timeout', 'translateFilter', 'Settings', 'UpdateSettings',
    function ($scope, $timeout, translateFilter, Settings, UpdateSettings) {
      
      $scope.submitAdvancedSettings = function() {
        $scope.errors = validate($scope.advancedSettingsModel, translateFilter);
        if ($scope.errors.found) {
          $scope.status = { error: true, msg: translateFilter('Failed validation') };
        } else {
          $scope.status = { loading: true };
          var changes = _.clone($scope.advancedSettingsModel);
          changes.forms_only_mode = !changes.accept_messages;
          delete changes.accept_messages;
          changes.outgoing_phone_replace.match = $('#outgoing-phone-replace-match').val();
          UpdateSettings(changes, function(err) {
            if (err) {
              console.log('Error updating settings', err);
              $scope.status = { error: true, msg: translateFilter('Error saving settings') };
            } else {
              $scope.status = { success: true, msg: translateFilter('Saved') };
              $timeout(function() {
                if ($scope.status) {
                  $scope.status.success = false;
                }
              }, 3000);
            }
          });
        }
      };

      $scope.updateDateFormatExample = function() {
        $scope.dateFormatExample = moment()
          .format($scope.advancedSettingsModel.date_format);
      };

      $scope.updateDatetimeFormatExample = function() {
        $scope.datetimeFormatExample = moment()
          .format($scope.advancedSettingsModel.reported_date_format);
      };

      Settings(function(err, res) {
        if (err) {
          return console.log('Error loading settings', err);
        }
        $scope.advancedSettingsModel = {
          accept_messages: !res.forms_only_mode,
          date_format: res.date_format,
          reported_date_format: res.reported_date_format,
          outgoing_phone_replace: res.outgoing_phone_replace,
          schedule_morning_hours: res.schedule_morning_hours,
          schedule_morning_minutes: res.schedule_morning_minutes,
          schedule_evening_hours: res.schedule_evening_hours,
          schedule_evening_minutes: res.schedule_evening_minutes
        };
        $scope.date_formats = standard_date_formats;
        if (!_.contains($scope.date_formats, res.date_format)) {
            $scope.date_formats.push(res.date_format);
        }
        $scope.datetime_formats = standard_datetime_formats;
        if (!_.contains($scope.datetime_formats, res.reported_date_format)) {
            $scope.datetime_formats.push(res.reported_date_format);
        }

        $scope.hours = generateTimeModels(24);
        $scope.minutes = generateTimeModels(60, 5);
        $scope.updateDateFormatExample();
        $scope.updateDatetimeFormatExample();
        $('#outgoing-phone-replace-match').select2({
          width: '20em',
          data: countries.list,
          placeholder: ' ',
          allowClear: true
        });
        $('#outgoing-phone-replace-match').select2('val', res.outgoing_phone_replace.match);
      });

    }
  ]);

}());
