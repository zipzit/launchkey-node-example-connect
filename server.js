/**
 * Copyright (C) 2015 LaunchKey, Inc.
 *
 * For the full copyright and license information, please view the LICENSE.txt
 * file that was distributed with this source code.
 *
 * @author Adam Englander <adam@launchkey.com>
 */

(function () {
    'use strict';

    var fs = require('fs'),                         // Use fs to read the secret key and template files
        http = require('http'),                     // http is needed by connect
        connect = require('connect'),               // connect is the web server
        favicon = require('serve-favicon'),         // serve favicons to stop silly error messages in the log
        morgan = require('morgan'),                 // for loggin middleware
        cookieSession = require('cookie-session'),  // cookie based session middleware to allow for persistent sessions
        handlebars = require('handlebars'),         // templating
        bodyParser = require('body-parser'),        // for parsing form data in the body
        LaunchKeySDK = require('launchkey-sdk'),    // for communicating with the LaunchKey Engine API
        Datastore = require('nedb'),                // Memory database to keep track of user status
        url = require('url'),                       // for parsing URLs
        qs = require('qs'),                         // for parsing query strings
        authRequests = new Datastore(),             // NeDB Collection for storing authentication data
        host = process.env.HOST || '0.0.0.0',       // host to listen on -- defaults to all
        port = process.env.PORT || 8080,            // port to listen on -- defaults to 8080
        app = connect(),                            // creates the connect app
        loginTemplate,                              // variable to store the compiled login template
        processingTemplate,                         // variable to store the compiled processing template
        authorizedTemplate,                         // variable to store the compiled authorized template
        launchKey,                                  // variabe for the initialized LaunchKey SDK client
        getAuthRequest;                             // variable for method to the current login status of the user

    /*************************************************
     Start LaunchKey SDK Initialization
     **************************************************/
    // Check that the necessary data is available.  If not, display usage
    if (!process.env.ROCKET_KEY || !process.env.SECRET_KEY || !process.env.PRIVATE_KEY) {
        console.error("The following environment variables are required:\n");
        console.error("    ROCKET_KEY   The Rocket Key from the LaunchKey Dashboard for this Rocket");
        console.error("    SECRET_KEY   The Secret Key from the LaunchKey Dashboard for this Rocket");
        console.error("    PRIVATE_KEY  The location of the file containing the Private Key of the RSA Public/Private key pair for this Rocket");
        console.error("\n\nConsult the README.md file for usage instructions");
        process.exit(1);
    }

    // Initialize the LaunchKey SDH with the necessary data
    launchKey = new LaunchKeySDK(process.env.ROCKET_KEY, process.env.SECRET_KEY, fs.readFileSync(process.env.PRIVATE_KEY));
    /*************************************************
     End LaunchKey SDK Initialization
     **************************************************/

    /*************************************************
     Start Connect middleware registration
     **************************************************/
    // Set up cookie session middleware with rotating keys
    app.use(cookieSession({
        httpOnly: true,
        signed: true,
        keys: [
            '97507766219598733799',
            '62607831018589607571',
            '15930103382421489336',
            '82183080801008383813',
            '33946345381602836258',
            '83993923763684288154',
            '79101365700006167564',
            '23041243406663012529',
            '62676470323870986593',
            '13241996736018308806'
        ]
    }));

    // Use morgan middleware for logging with the "dev" format
    app.use(morgan('dev'));

    // IUnitialize the favicon middleware with the location of the favicon
    app.use(favicon(__dirname + '/public/favicon.ico'));

    // initialize the body parser middleware and enable extended parsing
    // extended parsing isn't necessary but it doesn't hurt
    app.use(bodyParser.urlencoded({extended: true}));
    /*************************************************
     End Connect middleware registration
     **************************************************/

    /*************************************************
     Start templates
     **************************************************/
    // Register shared header partial
    handlebars.registerPartial('header', fs.readFileSync(__dirname + '/templates/header.html', {encoding: 'utf8'}));
    // Register shared footer partial
    handlebars.registerPartial('footer', fs.readFileSync(__dirname + '/templates/footer.html', {encoding: 'utf8'}));
    // Compile login page template
    loginTemplate = handlebars.compile(fs.readFileSync(__dirname + '/templates/login.html', {encoding: 'utf8'}));
    // Compile processing page template
    processingTemplate = handlebars.compile(fs.readFileSync(__dirname + '/templates/processing.html', {encoding: 'utf8'}));
    // Compile authorized page template
    authorizedTemplate = handlebars.compile(fs.readFileSync(__dirname + '/templates/authorized.html', {encoding: 'utf8'}));
    /*************************************************
     End templates
     **************************************************/

    // Method used to determine the current status of the user in the database
    getAuthRequest = function (authRequestId, success, error) {
        authRequests.findOne(                                                   // Find one authRequests record
            {authRequestId: authRequestId},                                     // by the passed authRequestId
            function (err, doc) {                                               // When complete
                if (err) {                                                      // If an error occurred
                    error(err);                                                 //   call the error callback;
                } else {                                                        // otherwise,
                    success(doc);                                               //   call the success callback with the record returned
                }
            }
        );
    };

    /*************************************************
     Start routes
     **************************************************/

    // Status route will be used by front end JavaScript to determine if
    // the status changed and the page should be refreshed
    app.use('/status', function (req, res) {
        var respond = function (code) {                                         // common code for responding
            var body = JSON.stringify({status: code});                          // Create a JSON object with the status
            res.writeHead(200, 'OK', {                                          // Set the appropriate headers
                'Content-Type': 'application/json',                             // content-type for teh JSON object
                'Content-Length': body.length                                   // and the length of the data
            });
            res.end(body);                                                      // and end the response
        };


        if (req.session.authRequestId) {                                        // If we have an auth request ID in the session,
            getAuthRequest(                                                     // get the related authRequests record
                req.session.authRequestId,                                      // using the authRequestId in the session
                function (doc) {
                    if (doc && doc.status) {                                    // If we found a doc and it has a status
                        respond(doc.status);                                    //   use that value as the status
                    } else {                                                    // If we did not find a doc,
                        req.session = null;                                     //   clear the session
                        respond(403);                                           //   and return unauthorized (403)
                    }
                }
            );
        } else {                                                                // If not, we have not started and return unauthorized
            respond(403);
        }
    });

    // Callback endpoint for server side events
    app.use('/launchkey-callback', function (req, res) {
        var queryStringParameters = qs.parse(url.parse(req.url, true).query),   // Parse the request URL to get the query string parameters
            callback = function (err, count) {                                  // Shared callback to respond to the LaunchKey Engine
                var message, code;
                if (err) {                                                      // If an error was passed,
                    message = err.message;                                      //   set the status message to the error message
                    code = 500;                                                 //   and set the code to 500
                } else if (count < 1) {                                         // If no records were affected by the callback
                    message = 'NOT FOUND';                                      //   return a not found message
                    code = 404;                                                 //   and a 404 status code
                } else {                                                        // Otherwise everything is fine
                    message = 'OK';                                             //   message is OK
                    code = 200;                                                 //   status is 200
                }
                res.writeHead(code, message);                                   // Write the header with the codee and message
                res.end();                                                      // End the response
            };

        launchKey.handleServerSideEvent(                                        // Tell the SDK to handle the request
            queryStringParameters,                                              // with the query string parmaeters
            function (authRequest) {                                            // For authorized,
                authRequests.update(                                            // update the authRequest record
                    {authRequestId: authRequest.getId()},                       // for the authRequestId passed in the event
                    {
                        authRequestId: authRequest.getId(),                     // with the same authRequestId (update replaces the whole record)
                        userHash: authRequest.getUserHash(),                    // the user hash sent in the event
                        status: 200                                             // and a status of 200
                    },
                    callback                                                    // and call the standard callback when done
                );
            },
            function (authRequest) {                                            // For unauthorized,
                authRequests.remove(                                            // delete the authRequest
                    {authRequestId: authRequest.getId()},                       // for the authRequestId passed in the event
                    callback                                                    // and call the standard callback when done
                );
            },
            function (userHash) {                                               // For de-orbit,
                authRequests.remove(                                            // delete the authRequest record
                    {userHash: userHash},                                       // for the user hash passed in the event
                    callback                                                    // and call the standard calbacl
                );
            },
            callback                                                            // For errors, just call the standard callback
        );
    });

    // Root route processes the wen page
    app.use('/', function (req, res) {
        var errorMessage = null,
            showLogin = function () {                                           // helper function fow showing the login page
                res.end(loginTemplate({                                         // Show the login template
                    currentStatusCode: 403,                                     // with a status code of 403 (unauthorized)
                    error: errorMessage                                         // and whatever error message has been set if any
                }));
            };

        if (req.method === 'POST' && req.body.username) {                       // This is a login submit
            launchKey.authenticate(                                             // Perform an authenticate request to teh LaunchKey Engine API
                req.body.username,                                              // for the username submitted in the form
                function (authRequestId) {                                      // On a successful request
                    var status = 401;                                           // The status should be 401 - authorize
                    authRequests.insert(                                        // Insert a new authRequests record
                        {authRequestId: authRequestId, status: status},         // with the current authRequestId and status
                        function (error) {                                      // When the insert request has completed
                            if (error) {                                        // If it's an error
                                errorMessage = error.message;                   //   set the error message
                                showLogin();                                    //   and show the login page
                            } else {                                            // Otherwise
                                req.session.authRequestId = authRequestId;      // Set the authRequestId in the session for later
                                res.writeHead(                                  // and redirect the user to the home page
                                    302,                                        // to prevent refreshes trying to re-post
                                    "Post POST redirect",
                                    {Location: '/'}
                                );
                                res.end();                                      // and finish the response
                            }
                        }
                    );
                },
                function (err) {                                                // If there is an error from the LaunchKey SDK
                    errorMessage = err.message;                                 //   set the error message
                    showLogin();                                                //   and show the login page
                }
            );
        } else if (req.method === 'POST' && req.body.deorbit) {                 // This is a de-orbit submit
            authRequests.remove(                                                // Remove the authRequests record from the database
                {authRequestId: req.session.authRequestId},                     // based on the authRequestId from the session
                function () {                                                   // When the remove action is completed
                    var authRequestId = req.session.authRequestId;
                    req.session = null;                                         // Reset the session
                    res.writeHead(                                              // and redirect the user to the home page
                        302,                                                    // to prevent refreshes trying to re-post
                        "Post DELETE redirect",
                        {Location: '/'}
                    );
                    res.end();                                                  // Finish the response
                    launchKey.deorbit(                                          // and inform the LaunchKey Engine about the deorbit
                        authRequestId,                                          // using the same authRequestId
                        function () {/* intentionally blank */},                // We don't care if we succeed
                        function () {/* intentionally blank */}                 // or fail
                    );
                }
            );
        } else if (req.session && req.session.authRequestId) {                  // This is a standard page load with an existing authRequestId in the session
            getAuthRequest(                                                     // get the authRequests record
                req.session.authRequestId,                                      // using the authReque4stId from the session
                function (doc) {                                                // If successful.
                    var template;                                               //   initialize a template variable
                    if (doc && doc.status === 200) {                            //   If a record is returned and its status is authorized (200)
                        template = authorizedTemplate;                          //     use the authorized template
                    } else if (doc && doc.status === 401) {                     //   Else, if a record is returned and its status is authorizing (401)
                        template = processingTemplate;                          //     use the processing template
                    } else {                                                    //   Otherwise,
                        req.session = null;                                     //      reset the session as the authReque4stId in the session no longer has a record in the database
                        showLogin();                                            //      show the login page
                        return;                                                 //      and short curcuit the callback
                    }
                    res.end(template({currentStatusCode: doc.status}));         // Show the appropriate template from above and pass the current status
                },
                function (err) {                                                // If there was an error getting the authRequests record
                    errorMessage = err.message;                                 //   set the error message
                    showLogin();                                                //   and show hte login page
                }
            );
        } else {                                                                // This is a page load with no session data
            showLogin();                                                        // Show the login page
        }
    });
    /*************************************************
     End routes
     **************************************************/

    // Create the HTTP server and start listening
    http.createServer(app).listen(port, host);
    console.log('Server listening on ' + host + ':' + port);
    console.log('Press Ctrl-C to quit.');
}());
