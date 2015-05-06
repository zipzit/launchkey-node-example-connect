LaunchKey Node.JS Connect Example
=================================

  * [Overview](#overview)
  * [Pre-Requisites](#prerequisites)
  * [Installing](#installing)
  * [Usage](#usage)
  * [Support](#support)

<a name="overview"></a>
# Overview

LaunchKey is an identity and access management platform  This SDK enables developers to quickly integrate
the LaunchKey platform and Node.JS based applications without the need to directly interact with the platform API.

Developer documentation for using the LaunchKey API is found [here](https://docs.launchkey.com).

An overview of the LaunchKey platform can be found [here](https://launchkey.com/MFA).

This demo application is by no means meant to show the most secure way to implement LaunchKey security in your
application.  It is, however, a simple implementation  that can be run anywhere to give you fist hand real world
experience with how an application secured with LaunchKey would work.

The demo code is highly commented to help you better understand the process used.

<a name="prerequisites">
#  </a>Pre-Requisites

## LaunchKey SDK requirements

Utilization of the LaunchKey SDK requires the following items:

 *  LaunchKey Account - The [LaunchKey Mobile App](https://docs.launchkey.com/user/mobile-app-guide/)
    is required to set up a new account and access the LaunchKey Dashboard.

 *  An application - A new application can be created in the [LaunchKey Dashboard](https://dashboard.launchkey.com/).
    From the application, you will need the following items found in the keys section of the application details:

    * The rocket key
    * The secret key
    * The private key

## Server side event handling requirements

In order for the server side events in this demonstration to work, your application will need to be reachable from the
Internet.  An easy way to accomplish this is with an open source product cal [Ngrok](https://ngrok.com/).  You can
download an install the client [from here](https://ngrok.com/download).

You can use direct access or a different reverse poxy solution but the examples will be based on Ngrok.

## Dependencies

The demo is a pure Node.js demo and does not require anything beyond NPM managed dependencies.

This demo utilizes [Connect](https://www.npmjs.com/package/connect) for managing web requests.  It also uses some
middleware to handle sessions, body parsing, query string parsing, fav icons, and logging. It  uses handlebars for
templating and NeDB to provide an in memory data store.

<a name="installing"></a>
# Installing

## Get the application code

```bash
$ git clone https://github.com/LaunchKey/launchkey-node-example-connect.git
```

or get a an archive from [the latest release](https://github.com/LaunchKey/launchkey-node-example-connect/releases/latest).

## Install Dependencies

Once you have the code you need to install the dependencies:

```bash
$ npm install
```

<a name="usage"></a>
# Usage

1. Start your server.  The server utilizes environment variables to configure it.  They are:

    * HOST - IP Address on which to listen for incoming requests. It defaults to all IP addresses (0.0.0.0)
    * PORT - TCP port on which to listen for incoming requests. It defaults to 8080
    * ROCKET_KEY - The Rocket Key from the LaunchKey Dashboard for this Rocket
    * SECRET_KEY - The Secret Key from the LaunchKey Dashboard for this Rocket
    * PRIVATE_KEY - The location of the file containing the Private Key of the RSA Public/Private key pair for this Rocket
    
    If you do not have the ROCKET_KEY, SECRET_KEY, and PRIVATE_KEY, use the
    [Getting Started Guide](https://docs.launchkey.com/common/getting-started-guide.html) to guide you in obtaining
    them.
    
    For assistance with setting environment variables, please refer to
    [this Wikipedia article](http://en.wikipedia.org/wiki/Environment_variable#Assignment)

    Use ```node server.js``` or ```npm start``` from the root directory of the project to start the server.
    
    Example:

        $ ROCKET_KEY=1234567890 SECRET_KEY=mysupersecretkey PRIVATE_KEY=/usr/locval/etc/rocket.pem node server.js
        /usr/local/bin/node server.js
        Server listening on 0.0.0.0:8080
        Press Ctrl-C to quit.

2.  Verify the server is running by accessing the URL of your web server.  For the example above, it should be
    [http://127.0.0.1:8080](http://127.0.0.1:8080).

3.  Start your reverse proxy.

    ```bash
    $ ngrok 8080
    ```
    
    Once started, you should see a a screen similar to:
    
        ngrok                                                                                          (Ctrl+C to quit)
    
        Tunnel Status                 online
        Version                       1.7/1.7
        Forwarding                    http://z4182320.ngrok.com -> 127.0.0.1:8080
        Forwarding                    https://z4182320.ngrok.com -> 127.0.0.1:8080
        Web Interface                 127.0.0.1:4040
        # Conn                        0
        Avg Conn Time                 0.00ms
    
4.  Verify your reverse proxy by accessing the reverse proxy endpoint.  The endpoint will be the first part of one of the
    Forwarding lines. Based on the example above it would be ```https://z4182320.ngrok.com``` or
    ```http://z4182320.ngrok.com```.  Copy your value for the Forwarding endpoint into you browser to ensure it is 
    working correctly.  If working correctly, it will displaying the same web page you saw when verifying your 
    web server as well as show 200 OK responses in the HTTP Requests section of the ngrok screen like below:

        ngrok                                                                                          (Ctrl+C to quit)
    
        Tunnel Status                 online
        Version                       1.7/1.7
        Forwarding                    http://z4182320.ngrok.com -> 127.0.0.1:8080
        Forwarding                    https://z4182320.ngrok.com -> 127.0.0.1:8080
        Web Interface                 127.0.0.1:4040
        # Conn                        2
        Avg Conn Time                 3.07ms
    
    
        HTTP Requests
        -------------
    
        GET /favicon.ico              200 OK
        GET /                         200 OK 

5.  Now that your web server and reverse proxy are working, update your application with the callback URL.  The callback
    URL is based on the reverse proxy URL you just verified.  It will be that URL plus the callback path registered
    with Connect.  That path will be ```/launchkey-callback``` for the example.  Based on the example above it would be
    ```https://z4182320.ngrok.com/launchkey-callback``` or ```http://z4182320.ngrok.com/launchkey-callback```.

6.  __Winning!__ - You should be ready to try the demo and see how the Node.js SDK can be used to quickly and easily
    secure your application with LaunchKey.

<a name="support"></a>
# Support

## GitHub

Submit feature requests and bugs on [GitHub](https://github.com/LaunchKey/launchkey-node-example-connect/issues).

## Twitter

Submit a question to the Twitter Handle [@LaunchKeyHelp](https://twitter.com/LaunchKeyHelp).

## IRC

Engage the LaunchKey team in the `#launchkey` chat room on [freenode](https://freenode.net/).

## LaunchKey Help Desk

Browse FAQ's or submit a question to the LaunchKey support team for both
technical and non-technical issues. Visit the LaunchKey Help Desk [here](https://launchkey.desk.com/).
