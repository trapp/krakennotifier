#!/usr/local/bin/node
var KrakenClient = require('kraken-api');
var nodemailer = require("nodemailer");
var spawn = require('child_process').spawn;
var async = require('async');
var fs = require('fs');
var crypto = require('crypto');
var config = require('./config.js');
var smtpTransport = nodemailer.createTransport("SMTP", config.smtp);
var registry = [];
var registryMap = {};

/**
 * Adds a client to the registry.
 *
 * @param mail
 * @param key
 * @param secret
 * @param callback
 */
exports.addClient = function(mail, key, secret, callback) {
    var id = hash(mail + key);
    if (registryMap.hasOwnProperty(id)) {
        callback(new Error('This API key exists already.'));
    } else {
        registryMap[id] = registry.length;
        registry.push({
            mail: mail,
            key: key,
            secret: secret
        });
    }
    save(callback);
};

/**
 * Removes a client from the registry.
 *
 * @param mail
 * @param key
 * @param callback {function}
 * @returns {boolean} True if addition was ok, false when this client already exists.
 */
exports.removeClient = function(mail, key, callback) {
    var id;
    console.log("Removing mail " + mail + ", key " + key);
    if (!key) {
        // Delete all subscriptions of this mail address
        var i = registry.length;
        while (i--) {
            if(registry[i].mail === mail) {
                id = hash(mail + registry[i].key);
                delete(registryMap[id]);
                registry.splice(i, 1);
            }
        }
    } else {
        id = hash(mail + key);
        if (registryMap.hasOwnProperty(id)) {
            registry.splice(registryMap[id], 1);
            delete(registryMap[id]);
        } else {
            callback(new Error("Key doesn't exist in storage."));
        }
    }
    save(callback);
};

exports.start = function() {
    var storage = './' + config.storageFile;
    fs.exists(storage, function(exists) {
        if (exists) {
            registry = require(storage);
            for (var i = 0; i < registry.length; i++) {
                var id = hash(registry[i].mail + registry[i].key);
                registryMap[id] = i;
            }
            console.log("Init complete. Going to check now.");
        } else {
            // Creating the file for the first time.
            save();
        }

        check();
    });
};

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
                if(data === null || error && client.lastResult != 'error') {
                    client.lastResult = 'error';
                    console.log("api error: ", error);
                    if (error == 'EAPI:Invalid nonce') {
                        // Invalid nonce errors get usually fixed with the next request.
                    } else if (error == 'EAPI:Invalid key') {
                        sendmail(client.mail, 'Your API key is not valid. Please create another subscription with a valid key if you want to receive further notification.', function() {
                            // Delete the invalid client.
                            exports.removeClient(client.mail, client.key, next);
                            console.log("client removed because of an invalid key: " + client.mail + ", " + client.key);
                        });
                    } else {
                        sendmail(client.mail, 'The Kraken api is not reachable currently. You will receive the next email once the api becomes accessible again.', next);
                    }
                } else {
                    var stringified = JSON.stringify(data.result);
                    if (client.lastResult != stringified) {
                        client.lastResult = stringified;
                        sendmail(client.mail, stringified, next);
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
    fs.writeFile(config.storageFile, "module.exports = " + JSON.stringify(registry) + ";", function(err) {
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

function sendmail(to, message, callback) {
    var mailOptions = config.mailOptions;
    mailOptions.text = message;
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
