
var tracker;

exports.inject = function(krakenTracker) {
    tracker = krakenTracker;
};

exports.subscribe = function(req, res) {
    var title = 'Add a new subscription';

    if (req.method == 'POST') {
        req.checkBody('mail', 'It looks like you forgot to enter your mail address.').notEmpty();
        req.checkBody('key', 'It looks like you forgot to enter your api key.').notEmpty();
        req.checkBody('secret', 'It looks like you forgot to enter your api secret.').notEmpty();

        var values = req.body || {};
        var errors = req.validationErrors(true) || {};
        if (Object.keys(errors).length > 0) {
            res.render('subscribe', { title: title, errors: errors, values: values});
        } else {

            tracker.addRequest(values.mail, values.key, values.secret, function(error) {
                if (error) {
                    errors['key'] = {
                        'msg': error.message
                    };
                    res.render('subscribe', { title: title, errors: errors, values: values});
                } else {
                    res.render('subscribe-success', { title: title});
                }
            });
        }
    } else {
        res.render('subscribe', { title: title});
    }
};

exports.unsubscribe = function(req, res) {
    var title = 'Remove a subscription';

    if (req.method == 'POST') {
        req.checkBody('mail', 'It looks like you forgot to enter your mail address.').notEmpty();

        var values = req.body || {};
        var errors = req.validationErrors(true) || {};
        if (Object.keys(errors).length > 0) {
            res.render('subscribe', { title: title, errors: errors, values: values});
        } else {

            tracker.removeRequest(values.mail, values.key, function(error) {
                if (error) {
                    errors[error.field || 'key'] = {
                        'msg': error.message
                    };
                    res.render('unsubscribe', { title: title, errors: errors, values: values});
                } else {
                    res.render('unsubscribe-success', { title: title});
                }
            });
        }
    } else {
        res.render('unsubscribe', { title: title});
    }
};

exports.confirm = function(req, res) {

    var title = 'Confirm an action.';

    req.checkQuery('token', 'Confirmation Token is missing.').notEmpty();
    var errors = req.validationErrors(true) || {};
    if (Object.keys(errors).length > 0) {
        res.render('confirm', { title: title, errors: errors});
    } else {
        tracker.confirm(req.query.token, function(error, message) {
            if (error) {
                errors['token'] = {
                    'msg': error.message
                };
                res.render('confirm', { title: title, errors: errors});
            }
            res.render('confirm', { title: title, message: message});
        });
    }
};

function getErrors(req) {
    var errorMap = {};
    var errors = req.validationErrors();
    if (errors && errors.length > 0) {
        errors.forEach(function(error) {
            errorMap[error.param] = error.msg;
        });
    }
    return errorMap;
}