var _ = require('underscore'),
    async = require('async'),
    config = require('../config'),
    messages = require('../lib/messages'),
    moment = require('moment'),
    validation = require('../lib/validation'),
    utils = require('../lib/utils'),
    date = require('../date');

module.exports = {
    filter: function(doc) {
        return Boolean(
            doc.form &&
            doc.patient_id &&
            doc.reported_date &&
            utils.getClinicPhone(doc)
        );
    },
    getAcceptedReports: function() {
        return config.get('patient_reports') || [];
    },
    silenceRegistrations: function(options, callback) {
        var doc = options.doc,
            report = options.report,
            registrations = options.registrations;

        if (report.silence_type) {
            async.forEach(registrations, function(registration, callback) {
                module.exports.silenceReminders({
                    db: options.db,
                    reported_date: options.reported_date,
                    registration: registration,
                    silence_for: report.silence_for,
                    type: report.silence_type
                }, callback);
            }, function(err) {
                callback(err, true);
            });
        } else {
            callback(null, true);
        }
    },
    matchRegistrations: function(options, callback) {
        var registrations = options.registrations,
            doc = options.doc,
            report = options.report;

        if (registrations && registrations.length) {
            messages.addReply(doc, report.report_accepted);
            module.exports.silenceRegistrations({
                db: options.db,
                report: report,
                reported_date: doc.reported_date,
                registrations: registrations
            }, callback);
        } else {
            messages.addError(doc, report.registration_not_found);
            callback(null, true);
        }
    },
    // find the messages to clear
    findToClear: function(options) {
        var registration = options.registration,
            silenceDuration = date.getDuration(options.silence_for),
            reportedDate = moment(options.reported_date),
            type = options.type,
            first,
            db = options.db,
            silenceUntil = reportedDate.clone();

        if (silenceDuration) {
            silenceUntil.add(silenceDuration);
        }

        return _.filter(utils.filterScheduledMessages(registration, type), function(msg) {
            var due = moment(msg.due),
                // due is after it was reported, but before the silence cutoff; also 'scheduled'
                matches = due >= reportedDate && due <= silenceUntil && msg.state === 'scheduled';

            // capture first match for group matching
            if (matches && !first) {
                first = msg;
            }
            // if groups match,always clear
            if (first && first.group === msg.group) {
                return true;
            // otherwise only if time/state matches
            } else {
                return matches;
            }
        });
    },
    silenceReminders: function(options, callback) {
        var registration = options.registration,
            toClear,
            db = options.db;

        // filter scheduled message by group
        toClear = module.exports.findToClear(options);

        // captured all to clear; now "clear" them
        _.each(toClear, function(msg) {
            msg.state = 'cleared';
        });

        if (toClear.length) {
            db.saveDoc(registration, callback);
        } else {
            callback(null);
        }
    },
    validate: function(report, doc) {
        return validation.validate(doc, report.validations);
    },
    handleReport: function(options, callback) {
        var db = options.db,
            doc = options.doc,
            report = options.report;

        utils.getRegistrations({
            db: db,
            id: doc.patient_id
        }, function(err, registrations) {
            module.exports.matchRegistrations({
                doc: doc,
                registrations: registrations,
                report: report
            }, callback);
        });
    },
    onMatch: function(change, db, callback) {
        var doc = change.doc,
            reports = module.exports.getAcceptedReports(),
            report,
            errors;

        report = _.findWhere(reports, {
            form: doc.form
        });

        if (!report) {
            return callback(null, false);
        }

        errors = module.exports.validate(report, doc);

        if (errors.length) {
            _.each(errors, function(error) {
                messages.addError(doc, error);
            });
            return callback(null, true);
        }

        module.exports.handleReport({
            db: db,
            doc: doc,
            report: report
        }, callback);
    },
    repeatable: true
};
