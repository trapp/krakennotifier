# Kraken Notifier

Sends an email when your kraken.com balance changes.

Check it out at: [krakennotifier.trapp.io](http://krakennotifier.trapp.io)

## Requirements

* NodeJS
* NPM
* Bower (If missing install with `npm install -g bower`)

## Installation

Installation is easy as pie. Checkout the sources:

    git clone https://github.com/trapp/krakennotifier

Download necessary dependencies:

    cd krakennotifier
    npm install
    bower install

Done! You're ready to configure it.

## Configuration

All configuration resides in one file: **config.js**

To start, just copy **config.js.example** to **config.js** or create a new file with this content:

    module.exports = {
        // Polling interval in milli seconds.
        interval: 60000,

        // Port and Host for the web interface.
        port: 3000,
        host: '127.0.0.1',
        ssl: null,
        // If you want to use SSL (you should), use this config for ssl:
        //ssl: {
        //    port: 3443,
        //    host: '127.0.0.1',
        //    key: 'path_to_ssl.key',
        //    cert: 'path_to_ssl.crt',
        //    ca: 'path_to_ca.pem'
        //},

        url: 'http://localhost', // The url for your service. Needed for the links in confirmation emails.

        // Location of the storage file. Contains all API-Keys.
        storageFile: './storage.js',

        // Mailing configuration.
        smtp: {
            host: "mail.example.com",
            secureConnection: false,
            port: 25,
            auth: {
                user: "user@example.com",
                pass: "example"
            }
        },
        mailOptions: {
            from: "Mister Example <example@example.com>", // sender address
            subject: "Kraken balance update"      // Subject line
        }
    };

Replace the mailer configuration with your data.

Done! You're ready to run it.

## Running

Just run app.js with node:

    node app.js

Open **http://localhost:3000/** and you're ready to go.