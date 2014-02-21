#!/usr/local/bin/node
var KrakenClient = require('kraken-api');
var nodemailer = require("nodemailer");
var spawn = require('child_process').spawn;

var config = require('./config.js');

var currentBalance = null;

var smtpTransport = nodemailer.createTransport("SMTP", config.smtp);

var kraken = new KrakenClient(config.key, config.secret);

check();
setInterval(check, 60000);

function check() {
    console.log(new Date(), "checking");
	// Display user's balance
	kraken.api('Balance', null, function(error, data) {
		if(error) {
			sendmail(JSON.stringify(error));
		}
		else {
			var stringified = JSON.stringify(data.result);
			if (stringified != currentBalance) {
				sendmail(stringified);
				currentBalance = stringified;
			}
		}
	});
};

function sendmail(message) {
    var mailOptions = config.mailOptions;
	
    var gpg = spawn(config.gpgCommand, ['-e', '-r', config.pubKeyId, '-a']);
    
    gpg.stdin.write(message);
    gpg.stdin.end();
    
    var encryptedMessage = "";
    
	gpg.stdout.on('data', function (data) {
	    encryptedMessage += data;
	});
	
	gpg.stderr.on('data', function (data) {
	    console.log('stderr: ' + data);
	});
	
	gpg.on('close', function (code) {
	    mailOptions.text = encryptedMessage;
	    smtpTransport.sendMail(mailOptions, function(error, response){
			if(error){
				console.log(error);
			}else{
				console.log("Message sent: " + response.message);
			}
		});
	});
}
