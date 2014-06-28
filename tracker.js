var KrakenClient = require('kraken-api');
var nodemailer = require("nodemailer");
var async = require('async');
var fs = require('fs');
var crypto = require('crypto');
var config = require('./config.js');
var errors = require('./errors.js');
var smtpTransport = nodemailer.createTransport("SMTP", config.smtp);
var registry = [];
var registryMap = {};

/**
 * Map of email tokens to confirm the addition or deletion of subscriptions.
 */
var confirmMap = {};
var TOKEN_ADD = 'add';
var TOKEN_REMOVE = 'remove';

exports.TOKEN_ADD = TOKEN_ADD;
exports.TOKEN_REMOVE = TOKEN_REMOVE;

/**
 * Confirms a request to delete or add a subscription.
 * @param token
 * @param callback
 */
exports.confirm = function(token, callback) {
    if (!confirmMap.hasOwnProperty(token)) {
        if (typeof callback == 'function') {
            callback(new Error("Sorry. We could not find this token."));
        }
        return;
    }
    var data = confirmMap[token];
    delete(confirmMap[token]);
    save(function(error) {
        if (error) {
            console.log("Error while removing token: " + error.message);
        }

        if (data.type == TOKEN_ADD) {
            addClient(data.mail, data.key, data.secret, function(error) {
                callback(error, data);
            });
        } else if (data.type == TOKEN_REMOVE) {
            removeClient(data.mail, data.key, function(error) {
                callback(error, data);
            });
        } else {
            callback(new Error("Invalid token data. Please contact support."));
        }
    });
};

/**
 * Initiates the process of adding a subscription.
 *
 * Sends an email to the mail address with a link to confirm.
 *
 * The client will be added after this confirmation.
 *
 * @param mail
 * @param key
 * @param secret
 * @param callback
 */
exports.addRequest = function(mail, key, secret, callback) {
    var id = hash(mail + key);
    if (registryMap.hasOwnProperty(id)) {
        callback(new Error('This API key exists already.'));
        return;
    }

    var token = hash(mail + key + secret + Date.now());
    confirmMap[token] = {
        type: TOKEN_ADD,
        mail: mail,
        key: key,
        secret: secret,
        date: Date.now()
    };
    save(function() {
        sendmail(mail, 'Please confirm your Kraken Notifier subscription by visiting this location: ' + config.url + "/confirm?token=" + token + "\n\n"
         + "If you did not enter your mail address at Kraken Notifier please ignore this email.", 'Welcome to Kraken Notifier', callback);
    });
};

/**
 * Initiates the process of removing a subscription.
 *
 * Sends an email to the mail address with a link to confirm.
 *
 * The client will be removed after this confirmation.
 *
 * @param mail
 * @param key
 * @param callback
 */
exports.removeRequest = function(mail, key, callback) {
    var found = false;
    if (!key) {
        // Look if we have this mail address in the storage.
        for (var i = 0; i < registry.length; i++) {
            if(registry[i].mail === mail) {
                found = true;
            }
        }
    } else if (registryMap.hasOwnProperty(hash(mail + key))) {
        found = true;
    }

    if (found === false) {
        if (!key) {
            callback(new errors.FieldError('mail', "This mail address doesn't exist in storage."));
        } else {
            callback(new errors.FieldError('key', "This key and email combination doesn't exist in storage."));
        }
        return;
    }

    var token = hash(mail + key + Date.now());
    confirmMap[token] = {
        type: TOKEN_REMOVE,
        mail: mail,
        key: key,
        date: Date.now()
    };

    var message = 'Please confirm the deletion of all Kraken Notifier subscriptions by visiting this location: ' + config.url + "/confirm?token=" + token + "\n\n"
        + "If you did not request a deletion at Kraken Notifier please ignore this email.";
    if (key) {
        message = 'Please confirm the deletion of Kraken Notifier notification for the key ' + key + ' by visiting this location: ' + config.url + "/confirm?token=" + token + "\n\n"
            + "If you did not request a deletion at Kraken Notifier please ignore this email.";
    }

    save(function() {
        sendmail(mail, message, 'Confirm Kraken Notifier removal request', callback);
    });
};

exports.start = function() {
    var storage = config.storageFile;
    fs.exists(storage, function(exists) {
        if (exists === true) {
            var data = require(storage);
            if (data && data.registry) {
                registry = data.registry;
            }
            if (data && data.token) {
                confirmMap = data.token;
            }
            for (var i = 0; i < registry.length; i++) {
                var id = hash(registry[i].mail + registry[i].key);
                registryMap[id] = i;
            }
            console.log("Init complete. Going to check now.");
        } else {
            console.log("Storagefile not found. Creating an empty one.");
            // Creating the file for the first time.
            save();
        }

        check();
    });
};

/**
 * Adds a client to the registry.
 *
 * @param mail
 * @param key
 * @param secret
 * @param callback
 */
function addClient (mail, key, secret, callback) {
    var id = hash(mail + key);
    if (registryMap.hasOwnProperty(id)) {
        callback(new Error('This API key exists already.'));
        return;
    } else {
        registryMap[id] = registry.length;
        registry.push({
            mail: mail,
            key: key,
            secret: secret
        });
    }
    save(function(error) {
        if (typeof callback != 'function') {
            return;
        }
        if (error) {
            callback(error);
        } else {
            callback(null);
        }
    });
}

/**
 * Removes a client from the registry.
 *
 * @param mail
 * @param key
 * @param callback {function}
 */
function removeClient(mail, key, callback) {
    var id;
    console.log("Removing mail " + mail + ", key " + key);
    if (!key) {
        // Delete all subscriptions of this mail address
        var i = registry.length;
        var found = false;
        while (i--) {
            if(registry[i].mail === mail) {
                id = hash(mail + registry[i].key);
                delete(registryMap[id]);
                registry.splice(i, 1);
                found = true;
            }
        }
        if (found === false) {
            callback(new errors.FieldError('mail', 'This mail address doesn\'t exist in storage.'));
            return;
        }
    } else {
        id = hash(mail + key);
        if (registryMap.hasOwnProperty(id)) {
            registry.splice(registryMap[id], 1);
            delete(registryMap[id]);
        } else {
            callback(new errors.FieldError('key', 'This combination of key and mail doesn\'t exist in storage.'));
            return;
        }
    }
    save(function(error) {
        if (typeof callback != 'function') {
            return;
        }
        if (error) {
            callback(error);
        } else {
            callback(null);
        }
    });
}

function hash(data) {
    var shasum = crypto.createHash('sha1');
    shasum.update(data);
    return shasum.digest('hex');
}

function check() {

    console.log("checking");

    var queue = [];
    registry.forEach(function(client) {
        queue.push(function(next) {
            var kraken = new KrakenClient(client.key, client.secret);
            kraken.api('Balance', null, function(error, data) {
                if(data === null || error) {
                    console.log("api error: ", error);
                    if (error == 'EAPI:Invalid nonce') {
                        // Invalid nonce errors get usually fixed with the next request.
			            next();
                    } else if (error == 'EAPI:Invalid key') {
                        sendmail(client.mail, 'Your API key is not valid. Please create another subscription with a valid key if you want to receive further notification.\n\nKey: ' + truncateKey(client.key), 'You key is invalid', function () {
                            // Delete the invalid client.
                            removeClient(client.mail, client.key, next);
                            console.log("client removed because of an invalid key: " + client.mail + ", " + client.key);
                        });
                    } else if (error == 'EGeneral:Permission denied') {
                        sendmail(client.mail, 'Your API key doesn\'t have the necessary permissions. Please add the permission "Query Funds" to your key and create a new subscription.\n\nKey: ' + truncateKey(client.key), 'You key doesn\'t have enough permissions', function () {
                            // Delete the invalid client.
                            removeClient(client.mail, client.key, next);
                            console.log("client removed because of missing permissions key: " + client.mail + ", " + truncateKey(client.key));
                        });
                    } else {
                        console.log("Unhandled error: " + error);
                        // We want to notify users of balance changes only.
                        // No need to throw errors at them every minute when the api is down.
			            next();
                    }
                } else {
                    var stringified = JSON.stringify(data.result);
                    if (client.lastResult != stringified) {
                        client.lastResult = stringified;
                        sendmail(client.mail, stringified, 'Kraken Balance update', next);
                    } else {
                        next();
                    }
                }
            });
        });
    });

    async.series(queue, function(errors, results) {
        // TODO error handling.
        // TODO: check if save is really necessary.
        save(function(error) {
            // TODO error handling
            setTimeout(check, config.interval);
        });
    });
}

function save(callback) {
    var data = {
        registry: registry,
        token: confirmMap
    };
    fs.writeFile(config.storageFile, "module.exports = " + JSON.stringify(data) + ";", function(err) {
        if(err) {
            console.log('error while saving', err);
            if (typeof callback == 'function') {
                callback(err);
            }
        } else {
            console.log('storage save successful. Serving ' + registry.length + " clients currently.");
            if (typeof callback == 'function') {
                callback();
            }
        }
    });
}

function truncateKey(key) {
    if (key && key.length > 0) {
        return key.substr(0, 10) + "… (truncated for security reasons)";
    }
    return key;
}

function sendmail(to, message, subject, callback) {
    var mailOptions = config.mailOptions;
    mailOptions.text = message;
    mailOptions.subject = subject;
    mailOptions.to = to;
    smtpTransport.sendMail(mailOptions, function(error, response){
        if (error){
            if (typeof callback == 'function') {
                callback(error);
            }
        } else {
            if (typeof callback == 'function') {
                callback();
            }
        }
    });
}
